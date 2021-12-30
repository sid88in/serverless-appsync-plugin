import { getAppSyncConfig } from './getAppSyncConfig';
import chalk from 'chalk';
import { forEach, last, merge } from 'lodash';
import { logger } from './utils';
import {
  CommandsDefinition,
  Hook,
  Provider,
  Serverless,
  ServerlessHelpers,
  ServerlessLogger,
} from './types/serverless';
import { Api } from './resources/Api';
import {
  DescribeStackResourcesInput,
  DescribeStackResourcesOutput,
} from 'aws-sdk/clients/cloudformation';
import {
  GetGraphqlApiRequest,
  GetGraphqlApiResponse,
  GetIntrospectionSchemaRequest,
  GetIntrospectionSchemaResponse,
  ListApiKeysRequest,
  ListApiKeysResponse,
} from 'aws-sdk/clients/appsync';
import { O } from 'ts-toolbelt';
import { AppSyncValidationError, validateConfig } from './validation';
import { GraphQLError } from 'graphql';
import fs from 'fs';
import path from 'path';
import open from 'open';

class ServerlessAppsyncPlugin {
  private provider: Provider;
  private gatheredData: {
    apis: {
      id: string;
      type: string;
      uri: string;
    }[];
    apiKeys: {
      value: string;
      description: string;
    }[];
  };
  public readonly hooks: Record<string, Hook>;
  public readonly commands?: CommandsDefinition;
  private log: ServerlessLogger;
  private api?: Api;
  private slsVersion: 'v2' | 'v3';

  constructor(
    public serverless: Serverless,
    private options: Record<string, string>,
    private helpers?: ServerlessHelpers,
  ) {
    this.gatheredData = {
      apis: [],
      apiKeys: [],
    };
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.slsVersion = helpers ? 'v3' : 'v2';

    // We are using a newer version of AJV than Serverless Frameowrk
    // and some customizations (eg: custom errors, $merge, filter irrelevant errors )
    // For SF, just validate the type of input to allow us to use a custom
    // field (ie: `appSync`). Actual valiation will be handled by this plugin
    // later in `validateConfig()`
    this.serverless.configSchemaHandler.defineTopLevelProperty('appSync', {
      type: 'object',
    });

    this.log =
      helpers?.log ||
      logger((message: string) => {
        return serverless.cli.log(message, 'AppSync');
      });

    this.commands = {
      appsync: {
        commands: {
          'validate-schema': {
            usage: 'Validates your graphql schema',
            lifecycleEvents: ['run'],
          },
          'get-introspection': {
            usage: "Get the API's introspection schema",
            lifecycleEvents: ['run'],
            options: {
              format: {
                usage: 'Specify the output format (JSON or SDL)',
                shortcut: 'f',
                required: false,
                type: 'string',
              },
              output: {
                usage: 'Output to a file',
                shortcut: 'o',
                required: false,
                type: 'string',
              },
            },
          },
          'flush-cache': {
            usage: 'Flushes the Cache of the API.',
            lifecycleEvents: ['run'],
          },
          console: {
            usage: 'Opens the AppSync AWS Console',
            lifecycleEvents: ['run'],
          },
          cloudwatch: {
            usage: 'Opens the CloudWatch AWS Console',
            lifecycleEvents: ['run'],
          },
        },
      },
    };

    this.hooks = {
      initialize: () => {
        this.loadConfig();
      },
      'appsync:validate-schema:run': () => {
        this.validateSchemas();
        this.log.success('AppSync schema valid');
      },
      'before:package:initialize': () => {
        this.buildAndAppendResources();
      },
      'appsync:get-introspection:run': () => this.getIntrospection(),
      'appsync:flush-cache:run': () => this.flushCache(),
      'appsync:console:run': () => this.openConsole(),
      'appsync:cloudwatch:run': () => this.openCloudWatch(),
      'before:aws:info:gatherData': () => {
        // load embedded functions
        this.buildAndAppendResources();
      },
      'after:aws:info:gatherData': () => this.gatherData(),
      'after:aws:info:displayServiceInfo': () => {
        this.displayEndpoints();
        this.displayApiKeys();
      },
    };
  }

  async getApiId() {
    const { StackResources } = await this.provider.request<
      DescribeStackResourcesInput,
      DescribeStackResourcesOutput
    >('CloudFormation', 'describeStackResources', {
      StackName: this.provider.naming.getStackName(),
    });

    const apiId = last(
      StackResources?.find(
        (resource) => resource.ResourceType === 'AWS::AppSync::GraphQLApi',
      )?.PhysicalResourceId?.split('/'),
    );

    if (!apiId) {
      throw new this.serverless.classes.Error(
        'Api not found in stack. Did you forget to deploy?',
      );
    }

    return apiId;
  }

  async gatherData() {
    const apiId = await this.getApiId();

    const { graphqlApi } = await this.provider.request<
      GetGraphqlApiRequest,
      O.Required<GetGraphqlApiResponse, string, 'deep'>
    >('AppSync', 'getGraphqlApi', {
      apiId,
    });

    if (!graphqlApi) {
      throw new this.serverless.classes.Error('Api not found');
    }

    forEach(graphqlApi.uris, (value, type) => {
      this.gatheredData.apis.push({
        id: graphqlApi.apiId,
        type: type.toLocaleLowerCase(),
        uri: value,
      });
    });

    const { apiKeys } = await this.provider.request<
      ListApiKeysRequest,
      O.Required<ListApiKeysResponse, string, 'deep'>
    >('AppSync', 'listApiKeys', {
      apiId: graphqlApi.apiId,
    });

    apiKeys?.forEach((apiKey) => {
      this.gatheredData.apiKeys.push({
        value: apiKey.id,
        description: apiKey.description || graphqlApi.name,
      });
    });
  }

  async getIntrospection() {
    const apiId = await this.getApiId();

    const { schema } = await this.provider.request<
      GetIntrospectionSchemaRequest,
      GetIntrospectionSchemaResponse
    >('AppSync', 'getIntrospectionSchema', {
      apiId,
      format: (this.options.format || 'JSON').toUpperCase(),
    });

    if (!schema) {
      throw new this.serverless.classes.Error('Schema not found');
    }

    if (this.options.output) {
      const filePath = path.resolve(this.options.output);
      fs.writeFileSync(filePath, schema.toString());
      this.log.success(`Introspection schema exported to ${filePath}`);
      return;
    }

    if (this.helpers?.writeText) {
      this.helpers?.writeText(schema.toString());
    } else {
      console.log(schema.toString());
    }
  }

  async flushCache() {
    const apiId = await this.getApiId();
    await this.provider.request('AppSync', 'flushApiCache', { apiId });
    this.log.success('Cache flushed successfully');
  }

  async openConsole() {
    const apiId = await this.getApiId();
    const { region } = this.serverless.service.provider;
    const url = `https://console.aws.amazon.com/appsync/home?region=${region}#/${apiId}/v1/home`;
    open(url);
  }

  async openCloudWatch() {
    const apiId = await this.getApiId();
    const { region } = this.serverless.service.provider;
    const url = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/$252Faws$252Fappsync$252Fapis$252F${apiId}`;
    open(url);
  }

  displayEndpoints() {
    const endpoints = this.gatheredData.apis.map(
      ({ type, uri }) => `${type}: ${uri}`,
    );

    if (this.slsVersion === 'v3') {
      this.serverless.addServiceOutputSection('appsync endpoints', endpoints);
    } else {
      let endpointsMessage = `${chalk.yellow('appsync endpoints:')}`;
      if (this.gatheredData.apis.length > 0) {
        endpoints.forEach((endpoint) => {
          endpointsMessage += `\n  ${endpoint}`;
        });
      } else {
        endpointsMessage += '\n  None';
      }

      console.log(endpointsMessage);
    }
  }

  displayApiKeys() {
    const { conceal } = this.options;
    const apiKeys = this.gatheredData.apiKeys.map(
      ({ description, value }) => `${value} (${description})`,
    );

    if (this.slsVersion === 'v3') {
      if (!conceal) {
        this.serverless.addServiceOutputSection('appsync api keys', apiKeys);
      }
    } else {
      let apiKeysMessage = `${chalk.yellow('appsync api keys:')}`;
      if (apiKeys.length > 0) {
        apiKeys.forEach((key) => {
          if (conceal) {
            apiKeysMessage += '\n  *** (concealed)';
          } else {
            apiKeysMessage += `\n  ${key}`;
          }
        });
      } else {
        apiKeysMessage += '\n  None';
      }

      console.log(apiKeysMessage);
    }
  }

  loadConfig() {
    this.log.info('Loading AppSync config');

    const { appSync } = this.serverless.configurationInput;

    try {
      validateConfig(appSync);
      const config = getAppSyncConfig(appSync);
      this.api = new Api(config, this);
    } catch (error) {
      if (error instanceof AppSyncValidationError) {
        this.handleConfigValidationError(error);
      } else {
        throw error;
      }
    }
  }

  validateSchemas() {
    try {
      this.log.info('Validating AppSync schema');
      if (!this.api) {
        throw new this.serverless.classes.Error(
          'Could not load hte API. This should not happen.',
        );
      }
      this.api.compileSchema();
    } catch (error) {
      this.log.info('Error');
      if (error instanceof GraphQLError) {
        this.handleError(error.message);
      }

      throw error;
    }
  }

  buildAndAppendResources() {
    if (!this.api) {
      throw new this.serverless.classes.Error(
        'Could not load hte API. This should not happen.',
      );
    }

    const resources = this.api.compile();
    merge(this.serverless.service, { resources: { Resources: resources } });
    merge(this.serverless.configurationInput, {
      functions: this.api.functions,
    });

    this.serverless.service.setFunctionNames(
      this.serverless.processedInput.options,
    );
  }

  handleConfigValidationError(error: AppSyncValidationError) {
    const errors = error.validationErrors.map(
      (error) => `     at appSync${error.path}: ${error.message}`,
    );
    const message = `Invalid AppSync Configuration:\n${errors.join('\n')}`;
    this.handleError(message);
  }

  handleError(message: string) {
    const { configValidationMode } = this.serverless.service;
    if (configValidationMode === 'error') {
      throw new this.serverless.classes.Error(
        `Invalid AppSync Schema: ${message}`,
      );
    } else if (configValidationMode === 'warn') {
      this.log.warning(message);
    }
  }
}

export = ServerlessAppsyncPlugin;

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
  ListApiKeysRequest,
  ListApiKeysResponse,
} from 'aws-sdk/clients/appsync';
import { O } from 'ts-toolbelt';
import { AppSyncValidationError, validateConfig } from './validation';
import { GraphQLError } from 'graphql';

class ServerlessAppsyncPlugin {
  private provider: Provider;
  private gatheredData: {
    apis: {
      id: string;
      name: string;
      type: string;
      uri: string;
    }[];
    apiKeys: {
      apiName: string;
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
    helpers?: ServerlessHelpers,
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
            usage: 'Validates your graphql schemas',
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

  async gatherData() {
    const { StackResources } = await this.provider.request<
      DescribeStackResourcesInput,
      DescribeStackResourcesOutput
    >('CloudFormation', 'describeStackResources', {
      StackName: this.provider.naming.getStackName(),
    });

    const apis =
      StackResources?.filter(
        (resource) => resource.ResourceType === 'AWS::AppSync::GraphQLApi',
      ).map((resource) => last(resource.PhysicalResourceId?.split('/'))) || [];

    for (const apiId of apis) {
      if (!apiId) {
        continue;
      }
      const { graphqlApi } = await this.provider.request<
        GetGraphqlApiRequest,
        O.Required<GetGraphqlApiResponse, string, 'deep'>
      >('AppSync', 'getGraphqlApi', {
        apiId,
      });

      if (!graphqlApi) {
        continue;
      }

      forEach(graphqlApi?.uris, (value, type) => {
        this.gatheredData.apis.push({
          id: apiId,
          name: graphqlApi?.name || apiId,
          type: type.toLocaleLowerCase(),
          uri: value,
        });
      });

      const { apiKeys } = await this.provider.request<
        ListApiKeysRequest,
        O.Required<ListApiKeysResponse, string, 'deep'>
      >('AppSync', 'listApiKeys', {
        apiId,
      });

      apiKeys?.forEach((apiKey) => {
        this.gatheredData.apiKeys.push({
          apiName: graphqlApi.name,
          value: apiKey.id,
          description: apiKey.description || graphqlApi.name,
        });
      });
    }
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

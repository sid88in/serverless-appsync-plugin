import { forEach, last, merge } from 'lodash';
import { getAppSyncConfig } from './getAppSyncConfig';
import { GraphQLError } from 'graphql';
import { DateTime } from 'luxon';
import chalk from 'chalk';
import path from 'path';
import open from 'open';
import fs from 'fs';
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
import {
  CommandsDefinition,
  ServerlessHelpers,
  ServerlessLogger,
  Serverless,
  Provider,
  Hook,
  VariablesSourcesDefinition,
  VariableSourceResolver,
} from './types/serverless';
import {
  FilterLogEventsResponse,
  FilterLogEventsRequest,
} from 'aws-sdk/clients/cloudwatchlogs';
import { AppSyncValidationError, validateConfig } from './validation';
import { logger, parseDateTimeOrDuration, wait } from './utils';
import { Api } from './resources/Api';
import { Naming } from './resources/Naming';

const CONSOLE_BASE_URL = 'https://console.aws.amazon.com';

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
      description?: string;
    }[];
  };
  public readonly hooks: Record<string, Hook>;
  public readonly commands?: CommandsDefinition;
  public readonly configurationVariablesSources?: VariablesSourcesDefinition;
  private log: ServerlessLogger;
  private writeText: (text: string) => void;
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
    this.writeText = this.helpers?.writeText || console.log;

    this.configurationVariablesSources = {
      appsync: {
        resolve: this.resolveVariable,
      },
    };

    this.commands = {
      appsync: {
        commands: {
          'validate-schema': {
            usage: 'Validate the graphql schema',
            lifecycleEvents: ['run'],
          },
          'get-introspection': {
            usage: "Get the API's introspection schema",
            lifecycleEvents: ['run'],
            options: {
              format: {
                usage:
                  'Specify the output format (JSON or SDL). Default: `JSON`',
                shortcut: 'f',
                required: false,
                type: 'string',
              },
              output: {
                usage: 'Output to a file. If not specified, writes to stdout',
                shortcut: 'o',
                required: false,
                type: 'string',
              },
            },
          },
          'flush-cache': {
            usage: 'Flushes the cache of the API.',
            lifecycleEvents: ['run'],
          },
          console: {
            usage: 'Open the AppSync AWS console',
            lifecycleEvents: ['run'],
          },
          cloudwatch: {
            usage: 'Open the CloudWatch AWS console',
            lifecycleEvents: ['run'],
          },
          logs: {
            usage: 'Output the logs of the AppSync API',
            lifecycleEvents: ['run'],
            options: {
              startTime: {
                usage: 'Starting time. Default: 10m (10 minutes ago)',
                required: false,
                type: 'string',
              },
              tail: {
                usage: 'Tail the log output',
                shortcut: 't',
                required: false,
                type: 'boolean',
              },
              interval: {
                usage: 'Tail polling interval in milliseconds. Default: `1000`',
                shortcut: 'i',
                required: false,
                type: 'string',
              },
              filter: {
                usage: 'A filter pattern to apply',
                shortcut: 'f',
                required: false,
                type: 'string',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'after:aws:info:gatherData': () => this.gatherData(),
      'after:aws:info:displayServiceInfo': () => {
        this.displayEndpoints();
        this.displayApiKeys();
      },
      // Commands
      'appsync:validate-schema:run': () => {
        this.validateSchemas();
        this.log.success('AppSync schema valid');
      },
      'appsync:get-introspection:run': () => this.getIntrospection(),
      'appsync:flush-cache:run': () => this.flushCache(),
      'appsync:console:run': () => this.openConsole(),
      'appsync:cloudwatch:run': () => this.openCloudWatch(),
      'appsync:logs:run': async () => this.initShowLogs(),
    };

    // These hooks need the config to be loaded and
    // processed in order to add embedded functions
    // to the service. (eg: function defined in resolvers)
    [
      'before:logs:logs',
      'before:deploy:function:initialize',
      'before:package:initialize',
      'before:aws:info:gatherData',
    ].forEach((hook) => {
      this.hooks[hook] = () => {
        this.loadConfig();
        this.buildAndAppendResources();
      };
    });
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
        'AppSync Api not found in stack. Did you forget to deploy?',
      );
    }

    return apiId;
  }

  async gatherData() {
    const apiId = await this.getApiId();

    const { graphqlApi } = await this.provider.request<
      GetGraphqlApiRequest,
      GetGraphqlApiResponse
    >('AppSync', 'getGraphqlApi', {
      apiId,
    });

    forEach(graphqlApi?.uris, (value, type) => {
      this.gatheredData.apis.push({
        id: apiId,
        type: type.toLowerCase(),
        uri: value,
      });
    });

    const { apiKeys } = await this.provider.request<
      ListApiKeysRequest,
      ListApiKeysResponse
    >('AppSync', 'listApiKeys', {
      apiId: apiId,
    });

    apiKeys?.forEach((apiKey) => {
      this.gatheredData.apiKeys.push({
        value: apiKey.id || 'unknown key',
        description: apiKey.description,
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
      try {
        const filePath = path.resolve(this.options.output);
        fs.writeFileSync(filePath, schema.toString());
        this.log.success(`Introspection schema exported to ${filePath}`);
      } catch (error) {
        this.log.error(`Could not save to file: ${(error as Error).message}`);
      }
      return;
    }

    this.writeText(schema.toString());
  }

  async flushCache() {
    const apiId = await this.getApiId();
    await this.provider.request('AppSync', 'flushApiCache', { apiId });
    this.log.success('Cache flushed successfully');
  }

  async openConsole() {
    const apiId = await this.getApiId();
    const { region } = this.serverless.service.provider;
    const url = `${CONSOLE_BASE_URL}/appsync/home?region=${region}#/${apiId}/v1/home`;
    open(url);
  }

  async openCloudWatch() {
    const apiId = await this.getApiId();
    const { region } = this.serverless.service.provider;
    const url = `${CONSOLE_BASE_URL}/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/$252Faws$252Fappsync$252Fapis$252F${apiId}`;
    open(url);
  }

  async initShowLogs() {
    const apiId = await this.getApiId();
    await this.showLogs(`/aws/appsync/apis/${apiId}`);
  }

  async showLogs(logGroupName: string, nextToken?: string) {
    let startTime: DateTime;
    if (this.options.startTime) {
      startTime = parseDateTimeOrDuration(this.options.startTime);
    } else {
      startTime = DateTime.now().minus({ minutes: 10 });
    }

    const { events, nextToken: newNextToken } = await this.provider.request<
      FilterLogEventsRequest,
      FilterLogEventsResponse
    >('CloudWatchLogs', 'filterLogEvents', {
      logGroupName,
      startTime: startTime.toMillis(),
      nextToken,
      filterPattern: this.options.filter,
    });

    events?.forEach((event) => {
      const { timestamp, message } = event;
      this.writeText(
        `${chalk.gray(
          DateTime.fromMillis(timestamp || 0).toISO(),
        )}\t${message}`,
      );
    });

    const lastTs = last(events)?.timestamp;
    this.options.startTime = lastTs
      ? DateTime.fromMillis(lastTs + 1).toISO()
      : this.options.startTime;

    if (this.options.tail) {
      const interval = this.options.interval
        ? parseInt(this.options.interval, 10)
        : 1000;
      await wait(interval);
      await this.showLogs(logGroupName, newNextToken);
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

  public resolveVariable: VariableSourceResolver = ({ address }) => {
    const naming = new Naming(this.serverless.configurationInput.appSync.name);

    if (address === 'id') {
      return {
        value: {
          'Fn::GetAtt': [naming.getApiLogicalId(), 'ApiId'],
        },
      };
    } else if (address === 'arn') {
      return {
        value: {
          'Fn::GetAtt': [naming.getApiLogicalId(), 'Arn'],
        },
      };
    } else if (address === 'url') {
      return {
        value: {
          'Fn::GetAtt': [naming.getApiLogicalId(), 'GraphQLUrl'],
        },
      };
    } else if (address.startsWith('apiKey.')) {
      const [, name] = address.split('.');
      return {
        value: {
          'Fn::GetAtt': [naming.getApiKeyLogicalId(name), 'ApiKey'],
        },
      };
    } else {
      throw new this.serverless.classes.Error(`Unknown address '${address}'`);
    }
  };

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

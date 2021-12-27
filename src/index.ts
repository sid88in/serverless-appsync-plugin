import { AppSyncConfigInput, getAppSyncConfig } from './getAppSyncConfig';
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
import { validateConfig } from './validation';
import { Schema } from './resources/Schema';

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
  private config: AppSyncConfigInput[];
  private log: ServerlessLogger;
  private apis: Api[] = [];
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

    if (!this.serverless.configurationInput.custom.appSync) {
      throw new Error('AppSync config is not defined');
    }

    const config = this.serverless.configurationInput.custom.appSync;
    this.config = Array.isArray(config) ? config : [config];

    this.commands = {
      'validate-schema': {
        usage: 'Validates your graphql schema',
        lifecycleEvents: ['run'],
      },
    };

    this.log = helpers?.log || logger(serverless.cli.log);
    this.slsVersion = helpers ? 'v3' : 'v2';

    this.hooks = {
      'package:initialize': async () => {
        this.validateConfig();
        await this.loadConfig();
      },
      'validate-schema:run': () => this.validateSchemas(),
      'after:package:initialize': () => this.addResources(),
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
      ({ name, type, uri }) => `${name} (${type}): ${uri}`,
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
      ({ apiName, description, value }) =>
        `${apiName}: ${value} (${description})`,
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

  async loadConfig() {
    const isSingleConfig = !Array.isArray(
      this.serverless.configurationInput.custom.appSync,
    );
    for (const inputConfig of this.config) {
      validateConfig(inputConfig);
      const config = await getAppSyncConfig(inputConfig);
      const api = new Api({ ...config, isSingleConfig }, this);
      this.apis.push(api);
    }
  }

  async validateSchemas() {
    try {
      this.log.info('Validating schema');
      for (const inputConfig of this.config) {
        const config = getAppSyncConfig(inputConfig);
        const api = new Api(config, this);
        const schema = new Schema(api, config.schema);
        // Generating the schema also validates it
        schema.generateSchema();
      }
      this.log.success('GraphQL schema valid');
    } catch (error) {
      this.log.error('GraphQL schema invalid');
      throw error;
    }
  }

  validateConfig() {
    for (const conf of this.config) {
      try {
        validateConfig(conf);
      } catch (error) {
        if (error instanceof Error) {
          this.log.error(error.message);
        } else {
          throw error;
        }
      }
    }
  }

  addResources() {
    this.apis?.forEach((api) => {
      const resources = api.compile();
      merge(this.serverless.service, { resources: { Resources: resources } });
      merge(this.serverless.configurationInput, { functions: api.functions });
    });
    this.serverless.service.setFunctionNames(
      this.serverless.processedInput.options,
    );
  }
}

export = ServerlessAppsyncPlugin;

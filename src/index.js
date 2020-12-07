const fs = require('fs');
const path = require('path');
const parseSchema = require('graphql/language').parse;
const runPlayground = require('./graphql-playground');
const getConfig = require('./get-config');
const chalk = require('chalk');
const { has } = require('ramda');

const MIGRATION_DOCS = 'https://github.com/sid88in/serverless-appsync-plugin/blob/master/README.md#cfn-migration';
const RESOURCE_API = 'GraphQlApi';
const RESOURCE_API_CLOUDWATCH_LOGS_ROLE = 'GraphQlApiCloudWatchLogsRole';
const RESOURCE_API_CLOUDWATCH_LOGS_POLICY = 'GraphQlApiCloudWatchLogsPolicy';
const RESOURCE_API_KEY = 'GraphQlApiKeyDefault';
const RESOURCE_SCHEMA = 'GraphQlSchema';
const RESOURCE_URL = 'GraphQlApiUrl';
const RESOURCE_API_ID = 'GraphQlApiId';
const RESOURCE_CACHING = 'GraphQlCaching';

const PHYS_RES_ID_REGEX = new RegExp('^arn:aws:appsync:(?:.*:apis/)(?<apiId>.*)/apikeys/(?<apiKeyId>.*)$');
const APPSYNC_API_KEY_ITER_REGEX = new RegExp(`^${RESOURCE_API_KEY}(?:_?)(?<apiKeyIter>.*)$`);

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.gatheredData = {
      endpoints: [],
      apiKeys: [],
    };
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.commands = {
      'delete-appsync': {
        usage: 'Helps you delete AppSync API',
        lifecycleEvents: ['delete'],
      },
      'validate-schema': {
        usage: 'Validates your graphql schema',
        lifecycleEvents: ['run'],
      },
      'graphql-playground': {
        usage: 'Runs a local graphql playground instance using your appsync config',
        options: {
          clientId: {
            usage: 'Specify your cognito client id (for AMAZON_COGNITO_USER_POOLS authType)',
            required: false,
          },
          username: {
            usage: 'Specify your username (for AMAZON_COGNITO_USER_POOLS authType)',
            shortcut: 'u',
            required: false,
          },
          password: {
            usage: 'Specify your password (for AMAZON_COGNITO_USER_POOLS authType)',
            shortcut: 'p',
            required: false,
          },
          jwtToken: {
            usage: 'Specify your jwtToken (for OPENID_CONNECT authType)',
            required: false,
          },
          apiKey: {
            usage: 'Specify your appsync api key (for API_KEY authType)',
            required: false,
          },
          port: {
            usage: 'Specify the local port graphql playground should run from',
            required: false,
          },
        },
        lifecycleEvents: ['run'],
      },
      'deploy-appsync': {
        usage: 'DEPRECATED: Helps you deploy AppSync API',
        lifecycleEvents: ['deploy'],
      },
      'update-appsync': {
        usage: 'DEPRECATED: Helps you update AppSync API',
        lifecycleEvents: ['update'],
      },
    };
    this.resolvedLogicalApiKeyId = undefined;

    this.log = this.log.bind(this);

    const generateMigrationErrorMessage = command => () => {
      throw new this.serverless.classes.Error(`serverless-appsync: ${command} `
        + `is no longer supported. See ${MIGRATION_DOCS} for more information`);
    };
    // Issue 159 - as of Serverless 1.12.0, before:deploy:initialize is replaced
    // by package:initialize.
    this.hooks = {
      'package:initialize': () => this.validateSchemas(),
      'validate-schema:run': () => this.validateSchemas(),
      'delete-appsync:delete': () => this.deleteGraphQLEndpoint(),
      'graphql-playground:run': () => this.runGraphqlPlayground(),
      'deploy-appsync:deploy': generateMigrationErrorMessage('deploy-appsync'),
      'update-appsync:update': generateMigrationErrorMessage('update-appsync'),
      'after:aws:package:finalize:mergeCustomProviderResources': async () => this.addResources(),
      'after:aws:info:gatherData': () => this.gatherData(),
      'after:aws:info:displayEndpoints': () => this.displayEndpoints(),
      'after:aws:info:displayApiKeys': () => this.displayApiKeys(),
    };
  }

  log(message, options) {
    this.serverless.cli.log(message, 'AppSync Plugin', options);
  }

  getLambdaArn(config) {
    if (config && config.lambdaFunctionArn) {
      return config.lambdaFunctionArn;
    } else if (config && config.functionName) {
      return this.generateLambdaArn(config.functionName);
    }
    throw new Error('You must specify either `lambdaFunctionArn` or `functionName` for lambda resolvers.');
  }

  generateLambdaArn(functionName) {
    const lambdaLogicalId = this.provider.naming.getLambdaLogicalId(functionName);
    return { 'Fn::GetAtt': [lambdaLogicalId, 'Arn'] };
  }

  getDbClusterArn(config) {
    if (config && config.dbClusterIdentifier) {
      return this.generateDbClusterArn(config.dbClusterIdentifier, config.region);
    }

    throw new Error('You must specify either `dbClusterIdentifier` for the resolver.');
  }

  generateDbClusterArn(dbClusterIdentifier, region) {
    return {
      'Fn::Join': [
        ':',
        [
          'arn',
          'aws',
          'rds',
          region,
          { Ref: 'AWS::AccountId' },
          'cluster',
          dbClusterIdentifier,
        ],
      ],
    };
  }

  getDeltaSyncConfig(config) {
    if (config && config.deltaSyncConfig) {
      if (!config.deltaSyncConfig.deltaSyncTableName) {
        throw new Error('You must specify `deltaSyncTableName` for Delta Sync configuration.');
      }
      return {
        BaseTableTTL: typeof config.deltaSyncConfig.baseTableTTL === 'undefined' ?
          0 : config.deltaSyncConfig.baseTableTTL,
        DeltaSyncTableName: config.deltaSyncConfig.deltaSyncTableName,
        DeltaSyncTableTTL: typeof config.deltaSyncConfig.deltaSyncTableTTL === 'undefined' ?
          60 : config.deltaSyncConfig.deltaSyncTableTTL,
      };
    }

    throw new Error('You must specify `deltaSyncConfig` for Delta Sync configuration.');
  }

  gatherData() {
    const stackName = this.provider.naming.getStackName();

    return this.provider.request(
      'CloudFormation',
      'describeStacks',
      { StackName: stackName },
    )
      .then((result) => {
        const outputs = result.Stacks[0].Outputs;
        outputs
          .filter(x => x.OutputKey.match(new RegExp(`${RESOURCE_URL}$`)))
          .forEach((x) => {
            this.gatheredData.endpoints.push(x.OutputValue);
          });

        outputs
          .filter(x => x.OutputKey.match(new RegExp(`${RESOURCE_API_KEY}$`)))
          .forEach((x) => {
            this.gatheredData.apiKeys.push(x.OutputValue);
          });
      });
  }

  async listStackResources() {
    const stackName = this.provider.naming.getStackName();

    return this.provider.request(
      'CloudFormation',
      'listStackResources',
      {
        StackName: stackName,
      },
    );
  }

  async listApiKeys(appsyncApiId) {
    const apiKeys = [];
    let response = {};
    do {
      // eslint-disable-next-line no-await-in-loop
      response = await this.provider.request(
        'AppSync',
        'listApiKeys',
        {
          apiId: appsyncApiId,
          maxResults: 25,
          nextToken: response.nextToken,
        },
      );
      apiKeys.push(...response.apiKeys);
    } while (response.nextToken);
    return apiKeys;
  }

  async listGraphqlApis() {
    const graphqlApis = [];
    let response = {};
    do {
      // eslint-disable-next-line no-await-in-loop
      response = await this.provider.request(
        'AppSync',
        'listGraphqlApis',
        {
          maxResults: 25,
          nextToken: response.nextToken,
        },
      );
      graphqlApis.push(...response.graphqlApis);
    } while (response.nextToken);
    return graphqlApis;
  }

  displayEndpoints() {
    let endpointsMessage = `${chalk.yellow('appsync endpoints:')}`;
    if (this.gatheredData.endpoints && this.gatheredData.endpoints.length) {
      this.gatheredData.endpoints.forEach((endpoint) => {
        endpointsMessage += `\n  ${endpoint}`;
      });
    } else {
      endpointsMessage += '\n  None';
    }

    this.serverless.cli.consoleLog(endpointsMessage);

    return endpointsMessage;
  }

  displayApiKeys() {
    const { conceal } = this.options;

    let apiKeysMessage = `${chalk.yellow('appsync api keys:')}`;
    if (this.gatheredData.apiKeys && this.gatheredData.apiKeys.length) {
      this.gatheredData.apiKeys.forEach((endpoint) => {
        if (conceal) {
          apiKeysMessage += '\n  *** (concealed)';
        } else {
          apiKeysMessage += `\n  ${endpoint}`;
        }
      });
    } else {
      apiKeysMessage += '\n  None';
    }

    this.serverless.cli.consoleLog(apiKeysMessage);

    return apiKeysMessage;
  }

  loadConfig() {
    return getConfig(
      this.serverless.service.custom.appSync,
      this.serverless.service.provider,
      this.serverless.config.servicePath,
    );
  }

  getSchemas() {
    const config = this.loadConfig();

    const awsTypes = `
      scalar AWSDate
      scalar AWSTime
      scalar AWSDateTime
      scalar AWSTimestamp
      scalar AWSEmail
      scalar AWSJSON
      scalar AWSURL
      scalar AWSPhone
      scalar AWSIPAddress
    `;

    return config.map(apiConfig => `${apiConfig.schema} ${awsTypes}`);
  }

  validateSchemas() {
    try {
      this.getSchemas().forEach(parseSchema);
      this.log('GraphQl schema valid');
    } catch (errors) {
      this.log(errors, { color: 'red' });
    }
  }

  deleteGraphQLEndpoint() {
    const config = this.loadConfig();
    return Promise.all(config.map((apiConfig) => {
      const { apiId } = apiConfig;
      if (!apiId) {
        throw new this.serverless.classes.Error('serverless-appsync: no apiId is defined. If you are not '
          + `migrating from a previous version of the plugin this is expected.  See ${MIGRATION_DOCS} '
        + 'for more information`);
      }

      this.log(`Deleting GraphQL Endpoint (${apiId})...`);
      return this.provider
        .request('AppSync', 'deleteGraphqlApi', {
          apiId,
        })
        .then((data) => {
          if (data) {
            this.log(`Successfully deleted GraphQL Endpoint: ${apiId}`);
          }
        });
    }));
  }

  runGraphqlPlayground() {
    // Use the first config or config map
    const firstConfig = this.loadConfig()[0];
    return runPlayground(this.provider, firstConfig, this.options)
      .then((url) => {
        this.log(`Graphql Playground Server Running at: ${url}`);
      })
      .then(() => new Promise(() => { }));
  }

  async addResources() {
    const config = this.loadConfig();

    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const outputs = this.serverless.service.provider.compiledCloudFormationTemplate.Outputs;

    // Iterate with a basic `for` loop to enable `await` on async functions
    for (let i = 0; i < config.length; i += 1) {
      const apiConfig = config[i];

      if (apiConfig.apiId) {
        this.log('WARNING: serverless-appsync has been updated in a breaking way and your '
          + 'service is configured using a reference to an existing apiKey in '
          + '`custom.appSync` which is used in the legacy deploy scripts. This deploy will create '
          + `new graphql resources and WILL NOT update your existing api. See ${MIGRATION_DOCS} for `
          + 'more information', { color: 'orange' });
      }

      Object.assign(resources, this.getGraphQlApiEndpointResource(apiConfig));
      // eslint-disable-next-line no-await-in-loop
      Object.assign(resources, await this.getApiKeyResources(apiConfig));
      Object.assign(resources, this.getApiCachingResource(apiConfig));
      Object.assign(resources, this.getGraphQLSchemaResource(apiConfig));
      Object.assign(resources, this.getCloudWatchLogsRole(apiConfig));
      Object.assign(resources, this.getDataSourceIamRolesResouces(apiConfig));
      Object.assign(resources, this.getDataSourceResources(apiConfig));
      Object.assign(resources, this.getFunctionConfigurationResources(apiConfig));
      Object.assign(resources, this.getResolverResources(apiConfig));

      Object.assign(outputs, this.getGraphQlApiOutputs(apiConfig));
      Object.assign(outputs, this.getApiKeyOutputs(apiConfig));
    }
  }

  getUserPoolConfig(provider, region) {
    const userPoolConfig = {
      AwsRegion: provider.userPoolConfig.awsRegion || region,
      UserPoolId: provider.userPoolConfig.userPoolId,
      AppIdClientRegex: provider.userPoolConfig.appIdClientRegex,
    };

    if (provider.userPoolConfig.defaultAction) {
      Object.assign(userPoolConfig, { DefaultAction: provider.userPoolConfig.defaultAction });
    }

    return userPoolConfig;
  }

  getOpenIDConnectConfig(provider) {
    const openIdConnectConfig = {
      Issuer: provider.openIdConnectConfig.issuer,
      ClientId: provider.openIdConnectConfig.clientId,
      IatTTL: provider.openIdConnectConfig.iatTTL,
      AuthTTL: provider.openIdConnectConfig.authTTL,
    };

    return openIdConnectConfig;
  }

  getTagsConfig(config) {
    return Object.keys(config.tags).map(key => ({
      Key: key,
      Value: config.tags[key],
    }));
  }

  mapAuthenticationProvider(provider, region) {
    const { authenticationType } = provider;
    const Provider = {
      AuthenticationType: authenticationType,
      UserPoolConfig: authenticationType !== 'AMAZON_COGNITO_USER_POOLS'
        ? undefined
        : this.getUserPoolConfig(provider, region),
      OpenIDConnectConfig: authenticationType !== 'OPENID_CONNECT'
        ? undefined
        : this.getOpenIDConnectConfig(provider),
    };

    return Provider;
  }

  getGraphQlApiEndpointResource(config) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdCloudWatchLogsRole = this.getLogicalId(
      config,
      RESOURCE_API_CLOUDWATCH_LOGS_ROLE,
    );

    if (config.authenticationType === 'AMAZON_COGNITO_USER_POOLS') {
      if (!config.userPoolConfig.defaultAction) {
        throw new this.serverless.classes.Error('userPoolConfig defaultAction is required');
      } else if (['ALLOW', 'DENY'].indexOf(config.userPoolConfig.defaultAction) === -1) {
        throw new this.serverless.classes.Error('userPoolConfig defaultAction must be either ALLOW or DENY');
      }
    }

    return {
      [logicalIdGraphQLApi]: {
        Type: 'AWS::AppSync::GraphQLApi',
        Properties: {
          Name: config.name,
          AuthenticationType: config.authenticationType,
          AdditionalAuthenticationProviders: config.additionalAuthenticationProviders
            .map(provider => this.mapAuthenticationProvider(provider, config.region)),
          UserPoolConfig: config.authenticationType !== 'AMAZON_COGNITO_USER_POOLS'
            ? undefined
            : this.getUserPoolConfig(config, config.region),
          OpenIDConnectConfig: config.authenticationType !== 'OPENID_CONNECT'
            ? undefined
            : this.getOpenIDConnectConfig(config),
          LogConfig: !config.logConfig ? undefined : {
            CloudWatchLogsRoleArn:
              config.logConfig.loggingRoleArn ||
              { 'Fn::GetAtt': [logicalIdCloudWatchLogsRole, 'Arn'] },
            FieldLogLevel: config.logConfig.level,
            ExcludeVerboseContent: config.logConfig.excludeVerboseContent,
          },
          XrayEnabled: config.xrayEnabled,
          Tags: !config.tags ? undefined : this.getTagsConfig(config),
        },
      },
      ...(config.logConfig && config.logConfig.level && {
        [`${logicalIdGraphQLApi}LogGroup`]: {
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: { 'Fn::Join': ['/', ['/aws/appsync/apis', { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] }]] },
            RetentionInDays: this.serverless.service.provider.logRetentionInDays,
          },
        },
      }),
    };
  }

  hasApiKeyAuth(config) {
    if (config.authenticationType === 'API_KEY' || config.additionalAuthenticationProviders.some(({ authenticationType }) => authenticationType === 'API_KEY')) {
      return true;
    }
    return false;
  }

  /**
   * Resolve an AppSync API id by name
   */
  async resolveAppSyncApiId(appsyncApiName) {
    // Unfortunately we need to brute force this since we don't have the AppSync API id
    const graphqlApis = await this.listGraphqlApis();
    if (graphqlApis) {
      const api = graphqlApis.find(curApi => curApi.name === appsyncApiName);
      return api ? api.apiId : undefined;
    }
    return undefined;
  }

  /**
   * Resolve the first matching API Key Resource for this API - there should only ever be 0 or 1
   */
  async resolveExistingApiKeyInfo({ baseKeyResourceIdName, appsyncApiName }) {
    // Find the AppSync API id for the well-known API name
    const appsyncApiId = await this.resolveAppSyncApiId(appsyncApiName);

    if (appsyncApiId) {
      const { StackResourceSummaries } = await this.listStackResources();

      for (let i = 0; i < StackResourceSummaries.length; i += 1) {
        const srs = StackResourceSummaries[i];
        if (srs.ResourceType === 'AWS::AppSync::ApiKey') {
          // Extract API id and key id from the physical resource id
          const {
            apiId,
            apiKeyId,
          } = PHYS_RES_ID_REGEX.exec(srs.PhysicalResourceId).groups;
          // Match on API id and base key resource name so we don't disturb CFN generated keys
          if (apiId === appsyncApiId && srs.LogicalResourceId.startsWith(baseKeyResourceIdName)) {
            return {
              apiId,
              apiKeyId,
              logicalResourceId: srs.LogicalResourceId,
            };
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Resolve the original logical key id value if the referenced API key still exists or generate
   * a new logical key id value if the referenced API key does not exist.
   *
   * @param baseKeyResourceIdName The base key name - this will be the prefix for all plugin
   * managed key ids
   * @param appsyncApiName The AppSync API name for the key
   * @return Resolved logical key id
   */
  async resolveLogicalIdApiKeyValueAndRevIfRequired({ baseKeyResourceIdName, appsyncApiName }) {
    try {
      // Find existing API key info
      const existingKeyInfo =
        await this.resolveExistingApiKeyInfo({ baseKeyResourceIdName, appsyncApiName });

      // If it doesn't exist, nothing to do - this is the first deploy
      if (!existingKeyInfo) {
        return undefined;
      }

      // List the API keys for this API id
      const apiKeys = await this.listApiKeys(existingKeyInfo.apiId);

      // Find a matching API key.  If found, we're done - return the logicalResourceId
      const apiKey = apiKeys
        && apiKeys.find(curApiKey => curApiKey.id === existingKeyInfo.apiKeyId);
      if (apiKey) {
        return existingKeyInfo.logicalResourceId;
      }

      /*
         The API key expected by the logical key CFN object does not exist.  This can happen if a
         key is deleted from the AppSync console or the key expired.  The logical key id becomes
         orphaned in this case.  Create a new logical resource id suffix in order to create a
         new, uniquely named AppSync API key CFN object.
      */
      this.log(`Resolving LogicalResourceId suffix to remove/replace existing CFN key object for API id ${existingKeyInfo.apiId} and resource ${existingKeyInfo.logicalResourceId}`);
      const { apiKeyIter } =
        APPSYNC_API_KEY_ITER_REGEX.exec(existingKeyInfo.logicalResourceId).groups;
      const newIterValue = apiKeyIter ? Number(apiKeyIter) + 1 : 1;

      return `${baseKeyResourceIdName}${newIterValue}`;
    } catch (e) {
      throw new this.serverless.classes.Error(`Error resolving new API key iteration: ${e.message}:${e.stack}`);
    }
  }

  async getApiKeyResources(config) {
    if (this.hasApiKeyAuth(config)) {
      const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
      const logicalIdApiKey = this.getLogicalId(config, RESOURCE_API_KEY);
      const description = `serverless-appsync-plugin: AppSync API Key for ${logicalIdApiKey}`;
      const expires = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

      let resolvedLogicalApiKeyId = logicalIdApiKey;
      if (config.apiKeyRepairEnabled) {
        /*
           Determine if the AppSync API key already associated with an existing CFN API key object
           from a previous deployment still exists.  If it does not exist, CFN will break while
           trying to resolve the non-existent key id.  This will create a new, unique logical API
           key id if this scenario is in play.  The net result is the previous orphaned CFN object
           will be deleted since it is no longer defined by the plugin output and a brand new
           object/key will be created on deploy.
        */
        const newLogicalIdValue = await this.resolveLogicalIdApiKeyValueAndRevIfRequired({
          baseKeyResourceIdName: logicalIdApiKey,
          appsyncApiName: config.name,
        });
        // If no value is returned, the CFN object does not exist so this is likely the first
        // deployment of the stack
        if (newLogicalIdValue) {
          resolvedLogicalApiKeyId = newLogicalIdValue;
        }
      }
      this.resolvedLogicalApiKeyId = resolvedLogicalApiKeyId;

      return {
        [resolvedLogicalApiKeyId]: {
          Type: 'AWS::AppSync::ApiKey',
          Properties: {
            ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
            Description: description,
            Expires: expires,
          },
        },
      };
    }
    return {};
  }

  getApiCachingResource(config) {
    if (config.caching) {
      const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
      const logicalIdCaching = this.getLogicalId(config, RESOURCE_CACHING);
      return {
        [logicalIdCaching]: {
          Type: 'AWS::AppSync::ApiCache',
          Properties: {
            ApiCachingBehavior: config.caching.behavior,
            ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
            AtRestEncryptionEnabled: config.caching.atRestEncryption || false,
            TransitEncryptionEnabled: config.caching.transitEncryption || false,
            Ttl: config.caching.ttl || 3600,
            Type: config.caching.type || 'T2_SMALL',
          },
        },
      };
    }

    return {};
  }

  getCloudWatchLogsRole(config) {
    if (!config.logConfig || config.logConfig.loggingRoleArn) {
      return {};
    }

    const logicalIdCloudWatchLogsRole = this.getLogicalId(
      config,
      RESOURCE_API_CLOUDWATCH_LOGS_ROLE,
    );
    const logicalIdCloudWatchLogsPolicy = this.getLogicalId(
      config,
      RESOURCE_API_CLOUDWATCH_LOGS_POLICY,
    );

    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logGroupResourceName = `${logicalIdGraphQLApi}LogGroup`;

    return {
      [logicalIdCloudWatchLogsPolicy]: {
        Type: 'AWS::IAM::Policy',
        Properties: {
          PolicyName: `${logicalIdCloudWatchLogsRole}Policy`,
          Roles: [
            { Ref: logicalIdCloudWatchLogsRole },
          ],
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'logs:CreateLogGroup',
                  'logs:CreateLogStream',
                  'logs:PutLogEvents',
                ],
                Resource: [
                  {
                    'Fn::GetAtt': [
                      logGroupResourceName,
                      'Arn',
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      [logicalIdCloudWatchLogsRole]: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: ['appsync.amazonaws.com'],
                },
                Action: ['sts:AssumeRole'],
              },
            ],
          },
        },
      },
    };
  }

  getDataSourceIamRolesResouces(config) {
    return config.dataSources.reduce((acc, ds) => {
      // Only generate DataSource Roles for compatible types
      // and if `serviceRoleArn` not provided
      const include = [
        'AWS_LAMBDA',
        'AMAZON_DYNAMODB',
        'AMAZON_ELASTICSEARCH',
        'RELATIONAL_DATABASE',
      ];
      if (!include.includes(ds.type) || (ds.config && ds.config.serviceRoleArn)) {
        return acc;
      }

      let statements;

      if (ds.config && ds.config.iamRoleStatements) {
        statements = ds.config.iamRoleStatements;
      } else {
        // Try to generate default statements for the given DataSource.
        statements = this.getDefaultDataSourcePolicyStatements(ds, config);

        // If we could not generate it, skip this step.
        if (statements === false) {
          return acc;
        }
      }

      const resource = {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: ['appsync.amazonaws.com'],
                },
                Action: ['sts:AssumeRole'],
              },
            ],
          },
          Policies: [
            {
              PolicyName: `${this.getDataSourceCfnName(ds.name)}Policy`,
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: statements,
              },
            },
          ],
        },
      };

      const logicalIdDataSource = this.getLogicalId(config, `${this.getDataSourceCfnName(ds.name)}Role`);
      return Object.assign({}, acc, { [logicalIdDataSource]: resource });
    }, {});
  }

  getDefaultDataSourcePolicyStatements(ds, config) {
    const defaultStatements = [];

    switch (ds.type) {
      case 'AWS_LAMBDA': {
        const lambdaArn = this.getLambdaArn(ds.config);

        // Allow "invoke" for the Datasource's function and its aliases/versions
        const defaultLambdaStatement = {
          Action: ['lambda:invokeFunction'],
          Effect: 'Allow',
          Resource: [
            lambdaArn,
            { 'Fn::Join': [':', [lambdaArn, '*']] },
          ],
        };

        defaultStatements.push(defaultLambdaStatement);
        break;
      }
      case 'AMAZON_DYNAMODB': {
        const dynamoDbResourceArn = {
          'Fn::Join': [
            ':',
            [
              'arn',
              'aws',
              'dynamodb',
              ds.config.region || config.region,
              { Ref: 'AWS::AccountId' },
              { 'Fn::Join': ['/', ['table', ds.config.tableName]] },
            ],
          ],
        };

        // Allow any action on the Datasource's table
        const defaultDynamoDBStatement = {
          Action: [
            'dynamodb:DeleteItem',
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:UpdateItem',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem',
            'dynamodb:ConditionCheckItem',
          ],
          Effect: 'Allow',
          Resource: [
            dynamoDbResourceArn,
            { 'Fn::Join': ['/', [dynamoDbResourceArn, '*']] },
          ],
        };

        defaultStatements.push(defaultDynamoDBStatement);
        break;
      }
      case 'RELATIONAL_DATABASE': {
        const dDbResourceArn = {
          'Fn::Join': [
            ':',
            [
              'arn',
              'aws',
              'rds',
              ds.config.region || config.region,
              { Ref: 'AWS::AccountId' },
              'cluster',
              ds.config.dbClusterIdentifier,
            ],
          ],
        };
        const dbStatement = {
          Effect: 'Allow',
          Action: [
            'rds-data:DeleteItems',
            'rds-data:ExecuteSql',
            'rds-data:ExecuteStatement',
            'rds-data:GetItems',
            'rds-data:InsertItems',
            'rds-data:UpdateItems',
          ],
          Resource: [
            dDbResourceArn,
            { 'Fn::Join': [':', [dDbResourceArn, '*']] },
          ],
        };

        const secretManagerStatement = {
          Effect: 'Allow',
          Action: [
            'secretsmanager:GetSecretValue',
          ],
          Resource: [
            ds.config.awsSecretStoreArn,
            { 'Fn::Join': [':', [ds.config.awsSecretStoreArn, '*']] },
          ],
        };

        defaultStatements.push(dbStatement, secretManagerStatement);
        break;
      }
      case 'AMAZON_ELASTICSEARCH': {
        let arn;
        if (ds.config.domain) {
          arn = { 'Fn::Join': ['/', [{ 'Fn::GetAtt': [ds.config.domain, 'Arn'] }, '*']] };
        } else if (ds.config.endpoint && typeof ds.config.endpoint === 'string') {
          const rx = /^https:\/\/([a-z0-9-]+\.\w{2}-[a-z]+-\d\.es\.amazonaws\.com)$/;
          const result = rx.exec(ds.config.endpoint);
          if (!result) {
            throw new this.serverless.classes.Error(`Invalid AWS ElasticSearch endpoint: '${ds.config.endpoint}`);
          }
          arn = {
            'Fn::Join': [':', [
              'arn',
              'aws',
              'es',
              ds.config.region || config.region,
              { Ref: 'AWS::AccountId' },
              `domain/${result[1]}/*`,
            ]],
          };
        } else {
          throw new this.serverless.classes.Error(`Could not determine the Arn for dataSource '${ds.name}`);
        }

        // Allow any action on the Datasource's ES endpoint
        const defaultESStatement = {
          Action: [
            'es:ESHttpDelete',
            'es:ESHttpGet',
            'es:ESHttpHead',
            'es:ESHttpPost',
            'es:ESHttpPut',
            'es:ESHttpPatch',
          ],
          Effect: 'Allow',
          Resource: [arn],
        };

        defaultStatements.push(defaultESStatement);
        break;
      }
      default:
        // unknown or non compatible type
        return false;
    }

    return defaultStatements;
  }

  getDataSourceResources(config) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    return config.dataSources.reduce((acc, ds) => {
      const resource = {
        Type: 'AWS::AppSync::DataSource',
        Properties: {
          ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
          Name: ds.name,
          Description: ds.description,
          Type: ds.type,
        },
      };

      // If a serviceRoleArn was given for this DataSource, use it
      if (ds.config && ds.config.serviceRoleArn) {
        resource.Properties.ServiceRoleArn = ds.config.serviceRoleArn;
      } else {
        const logicalIdDataSourceRole = this.getLogicalId(config, `${this.getDataSourceCfnName(ds.name)}Role`);
        // If a Role Resource was generated for this DataSource, use it
        const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
        const role = resources[logicalIdDataSourceRole];
        if (role) {
          resource.Properties.ServiceRoleArn = { 'Fn::GetAtt': [logicalIdDataSourceRole, 'Arn'] };
        }
      }

      if (ds.type === 'AWS_LAMBDA') {
        resource.Properties.LambdaConfig = {
          LambdaFunctionArn: this.getLambdaArn(ds.config),
        };
      } else if (ds.type === 'AMAZON_DYNAMODB') {
        resource.Properties.DynamoDBConfig = {
          AwsRegion: ds.config.region || config.region,
          TableName: ds.config.tableName,
          UseCallerCredentials: !!ds.config.useCallerCredentials,
          Versioned: !!ds.config.versioned,
        };
        if (resource.Properties.DynamoDBConfig.Versioned) {
          resource.Properties.DynamoDBConfig.DeltaSyncConfig =
            this.getDeltaSyncConfig(Object.assign({}, ds.config));
        }
      } else if (ds.type === 'AMAZON_ELASTICSEARCH') {
        resource.Properties.ElasticsearchConfig = {
          AwsRegion: ds.config.region || config.region,
          Endpoint: ds.config.endpoint || {
            'Fn::Join': ['', ['https://', { 'Fn::GetAtt': [ds.config.domain, 'DomainEndpoint'] }]],
          },
        };
      } else if (ds.type === 'RELATIONAL_DATABASE') {
        resource.Properties.RelationalDatabaseConfig = {
          RdsHttpEndpointConfig: {
            AwsRegion: ds.config.region || config.region,
            DbClusterIdentifier: this.getDbClusterArn(Object.assign({}, ds.config, config)),
            DatabaseName: ds.config.databaseName,
            Schema: ds.config.schema,
            AwsSecretStoreArn: ds.config.awsSecretStoreArn,
          },
          RelationalDatabaseSourceType: ds.config.relationalDatabaseSourceType || 'RDS_HTTP_ENDPOINT',
        };
      } else if (ds.type === 'HTTP') {
        const authConfig = ds.config.authorizationConfig;
        const authorizationConfig = {
          ...(authConfig && {
            AuthorizationConfig: {
              ...(authConfig.authorizationType && {
                AuthorizationType: authConfig.authorizationType,
              }),
              ...(authConfig.awsIamConfig && {
                AwsIamConfig: {
                  SigningRegion: authConfig.awsIamConfig.signingRegion || config.region,
                  ...(authConfig.awsIamConfig.signingServiceName && {
                    SigningServiceName:
                      authConfig.awsIamConfig.signingServiceName,
                  }),
                },
              }),
            },
          }),
        };

        resource.Properties.HttpConfig = {
          Endpoint: ds.config.endpoint,
          ...authorizationConfig,
        };
      } else if (ds.type !== 'NONE') {
        throw new this.serverless.classes.Error(`Data Source Type not supported: ${ds.type}`);
      }
      const logicalIdDataSource = this.getLogicalId(config, this.getDataSourceCfnName(ds.name));
      return Object.assign({}, acc, { [logicalIdDataSource]: resource });
    }, {});
  }

  getGraphQLSchemaResource(config) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdGraphQLSchema = this.getLogicalId(config, RESOURCE_SCHEMA);
    const appSyncSafeSchema = config.schema
      .replace(/"""[^"]*"""\n/g, '') // appsync does not support the new style descriptions
      .replace(/#.*\n/g, '') // appysnc does not support old-style # comments in enums, so remove them all
      .replace(/ *& */g, ', '); // appsync does not support the standard '&', but the "unofficial" ',' join for interfaces
    return {
      [logicalIdGraphQLSchema]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: appSyncSafeSchema,
          ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        },
      },
    };
  }
  getFunctionConfigurationResources(config) {
    const flattenedFunctionConfigurationResources = config.functionConfigurations
      .reduce((accumulator, currentValue) => accumulator.concat(currentValue), []);
    const functionConfigLocation = config.functionConfigurationsLocation;
    return flattenedFunctionConfigurationResources.reduce((acc, tpl) => {
      const logicalIdFunctionConfiguration = this.getLogicalId(
        config,
        `GraphQlFunctionConfiguration${this.getCfnName(tpl.name)}`,
      );
      const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
      const logicalIdDataSource = this.getLogicalId(
        config,
        this.getDataSourceCfnName(tpl.dataSource),
      );

      const Properties = {
        ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        Name: this.getCfnName(tpl.name),
        DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
        Description: tpl.description,
        FunctionVersion: '2018-05-29',
      };

      const requestTemplate = has('request')(tpl)
        ? tpl.request
        : config.defaultMappingTemplates.request;
      if (requestTemplate !== false) {
        const reqTemplPath = path.join(
          functionConfigLocation,
          requestTemplate || `${tpl.name}.request.vtl`,
        );
        const requestTemplateContent = fs.readFileSync(reqTemplPath, 'utf8');
        Properties.RequestMappingTemplate = this.processTemplate(
          requestTemplateContent,
          config,
          tpl.substitutions,
        );
      }

      const responseTemplate = has('response')(tpl)
        ? tpl.response
        : config.defaultMappingTemplates.response;
      if (responseTemplate !== false) {
        const respTemplPath = path.join(
          functionConfigLocation,
          responseTemplate || `${tpl.name}.response.vtl`,
        );
        const responseTemplateContent = fs.readFileSync(respTemplPath, 'utf8');
        Properties.ResponseMappingTemplate = this.processTemplate(
          responseTemplateContent,
          config,
          tpl.substitutions,
        );
      }

      return Object.assign({}, acc, {
        [logicalIdFunctionConfiguration]: {
          Type: 'AWS::AppSync::FunctionConfiguration',
          Properties,
        },
      });
    }, {});
  }

  getResolverResources(config) {
    const flattenedMappingTemplates = config.mappingTemplates
      .reduce((accumulator, currentValue) => accumulator.concat(currentValue), []);
    return flattenedMappingTemplates.reduce((acc, tpl) => {
      const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
      const logicalIdGraphQLSchema = this.getLogicalId(config, RESOURCE_SCHEMA);
      const logicalIdResolver = this.getLogicalId(
        config,
        `GraphQlResolver${this.getCfnName(tpl.type)}${this.getCfnName(tpl.field)}`,
      );

      let Properties = {
        ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        TypeName: tpl.type,
        FieldName: tpl.field,
      };

      const requestTemplate = has('request')(tpl)
        ? tpl.request
        : config.defaultMappingTemplates.request;
      if (requestTemplate !== false) {
        const reqTemplPath = path.join(
          config.mappingTemplatesLocation,
          requestTemplate || `${tpl.type}.${tpl.field}.request.vtl`,
        );
        const requestTemplateContent = fs.readFileSync(reqTemplPath, 'utf8');
        Properties.RequestMappingTemplate = this.processTemplate(
          requestTemplateContent,
          config,
          tpl.substitutions,
        );
      }

      const responseTemplate = has('response')(tpl)
        ? tpl.response
        : config.defaultMappingTemplates.response;
      if (responseTemplate !== false) {
        const respTemplPath = path.join(
          config.mappingTemplatesLocation,
          responseTemplate || `${tpl.type}.${tpl.field}.response.vtl`,
        );
        const responseTemplateContent = fs.readFileSync(respTemplPath, 'utf8');
        Properties.ResponseMappingTemplate = this.processTemplate(
          responseTemplateContent,
          config,
          tpl.substitutions,
        );
      }

      if (config.caching) {
        if (tpl.caching === true) {
          // Use defaults
          Properties.CachingConfig = {
            Ttl: config.caching.ttl || 3600,
          };
        } else if (typeof tpl.caching === 'object') {
          Properties.CachingConfig = {
            CachingKeys: tpl.caching.keys,
            Ttl: tpl.caching.ttl || config.caching.ttl || 3600,
          };
        }
      }

      if (tpl.sync === true) {
        // Use defaults
        Properties.SyncConfig = {
          ConflictDetection: 'VERSION',
        };
      } else if (typeof tpl.sync === 'object') {
        Properties.SyncConfig = {
          ConflictDetection: tpl.sync.conflictDetection,
          ConflictHandler: tpl.sync.conflictHandler,
          ...(
            tpl.sync.conflictHandler === 'LAMBDA' ?
              {
                LambdaConflictHandlerConfig: {
                  LambdaConflictHandlerArn: this.getLambdaArn(tpl.sync),
                },
              }
              : {}
          ),
        };
      }

      if (tpl.kind === 'PIPELINE') {
        Properties = {
          ...Properties,
          Kind: 'PIPELINE',
          PipelineConfig: {
            Functions: tpl.functions.map((functionAttributeName) => {
              const logicalIdDataSource = this.getLogicalId(
                config,
                `GraphQlFunctionConfiguration${this.getCfnName(functionAttributeName)}`,
              );
              return { 'Fn::GetAtt': [logicalIdDataSource, 'FunctionId'] };
            }),
          },
        };
      } else {
        Properties = {
          ...Properties,
          Kind: 'UNIT',
          DataSourceName: {
            'Fn::GetAtt': [
              this.getLogicalId(config, this.getDataSourceCfnName(tpl.dataSource)),
              'Name',
            ],
          },
        };
      }

      return Object.assign({}, acc, {
        [logicalIdResolver]: {
          Type: 'AWS::AppSync::Resolver',
          DependsOn: logicalIdGraphQLSchema,
          Properties,
        },
      });
    }, {});
  }

  getLogicalId(config, resourceType) {
    // Similar to serverless' implementation of functions
    // (e.g. getUser becomes GetUserLambdaFunction for CloudFormation logical ID,
    //  myService becomes MyServiceGraphQLApi or `MyService${resourceType}`)
    if (config.isSingleConfig) {
      // This will ensure people with CloudFormation stack dependencies on the previous
      // version of the plugin doesn't break their {@code deleteGraphQLEndpoint} functionality
      return this.getCfnName(resourceType);
    }
    return this.getCfnName(config.name[0].toUpperCase() + config.name.slice(1) + resourceType);
  }

  getGraphQlApiOutputs(config) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdGraphQLApiUrlOutput = this.getLogicalId(config, RESOURCE_URL);
    const logicalIdGraphQLApiIdOutput = this.getLogicalId(config, RESOURCE_API_ID);
    return {
      [logicalIdGraphQLApiUrlOutput]: {
        Value: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'GraphQLUrl'] },
      },
      [logicalIdGraphQLApiIdOutput]: {
        Value: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
      },
    };
  }

  getApiKeyOutputs(config) {
    if (this.hasApiKeyAuth(config)) {
      const logicalIdApiKeyOutput = this.getLogicalId(config, RESOURCE_API_KEY);
      return {
        [logicalIdApiKeyOutput]: {
          // Use the logicalApiKey id resolved in #getApiKeyResources
          Value: { 'Fn::GetAtt': [this.resolvedLogicalApiKeyId, 'ApiKey'] },
        },
      };
    }
    return {};
  }

  getCfnName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  getDataSourceCfnName(name) {
    return `GraphQlDs${this.getCfnName(name)}`;
  }

  processTemplate(template, config, tplSubstitutions) {
    // TODO use serverless variable parser and serverless variable syntax config
    const variableSyntax = RegExp(/\${([\w\d-_]+)}/g);
    const allSubstitutions = { ...config.substitutions, ...tplSubstitutions };
    const configVariables = Object.keys(allSubstitutions);
    const templateVariables = [];
    let searchResult;
    // eslint-disable-next-line no-cond-assign
    while ((searchResult = variableSyntax.exec(template)) !== null) {
      templateVariables.push(searchResult[1]);
    }

    const substitutions = configVariables
      .filter(value => templateVariables.indexOf(value) > -1)
      .filter((value, index, array) => array.indexOf(value) === index)
      .reduce(
        (accum, value) => Object.assign(accum, { [value]: allSubstitutions[value] }),
        {},
      );

    // if there are substitutions for this template then add fn:sub
    if (Object.keys(substitutions).length > 0) {
      return this.substituteGlobalTemplateVariables(template, substitutions);
    }

    return template;
  }

  /**
   * Creates Fn::Join object from given template where all given substitutions
   * are wrapped in Fn::Sub objects. This enables template to have also
   * characters that are not only alphanumeric, underscores, periods, and colons.
   *
   * @param {*} template
   * @param {*} substitutions
   */
  substituteGlobalTemplateVariables(template, substitutions) {
    const variables = Object.keys(substitutions).join('|');
    const regex = new RegExp(`\\\${(${variables})}`, 'g');
    const substituteTemplate = template.replace(regex, '|||$1|||');

    const templateJoin = substituteTemplate.split('|||');
    for (let i = 0; i < templateJoin.length; i += 1) {
      if (substitutions[templateJoin[i]]) {
        const subs = { [templateJoin[i]]: substitutions[templateJoin[i]] };
        templateJoin[i] = { 'Fn::Sub': [`\${${templateJoin[i]}}`, subs] };
      }
    }
    return { 'Fn::Join': ['', templateJoin] };
  }
}

module.exports = ServerlessAppsyncPlugin;

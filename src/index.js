const fs = require('fs');
const path = require('path');
const parseSchema = require('graphql/language').parse;
const { buildASTSchema } = require('graphql/utilities');
const runPlayground = require('./graphql-playground');
const getConfig = require('./get-config');
const chalk = require('chalk');
const { has, merge, last } = require('ramda');
const {
  parseDuration,
  toCfnKeys,
  getHostedZoneName,
  confirmAction,
  wait,
} = require('./utils');
const moment = require('moment');

const MIGRATION_DOCS =
  'https://github.com/sid88in/serverless-appsync-plugin/blob/master/README.md#cfn-migration';
const RESOURCE_API = 'GraphQlApi';
const RESOURCE_API_CLOUDWATCH_LOGS_ROLE = 'GraphQlApiCloudWatchLogsRole';
const RESOURCE_API_CLOUDWATCH_LOGS_POLICY = 'GraphQlApiCloudWatchLogsPolicy';
const RESOURCE_API_KEY = 'GraphQlApiKey';
const RESOURCE_SCHEMA = 'GraphQlSchema';
const RESOURCE_URL = 'GraphQlApiUrl';
const RESOURCE_API_ID = 'GraphQlApiId';
const RESOURCE_CACHING = 'GraphQlCaching';
const RESOURCE_WAF = 'GraphQlWaf';
const RESOURCE_WAF_ASSOC = 'GraphQlWafAssoc';

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
        usage:
          'Runs a local graphql playground instance using your appsync config',
        options: {
          clientId: {
            usage:
              'Specify your cognito client id (for AMAZON_COGNITO_USER_POOLS authType)',
            required: false,
            type: 'string',
          },
          username: {
            usage:
              'Specify your username (for AMAZON_COGNITO_USER_POOLS authType)',
            shortcut: 'u',
            required: false,
            type: 'string',
          },
          password: {
            usage:
              'Specify your password (for AMAZON_COGNITO_USER_POOLS authType)',
            shortcut: 'p',
            required: false,
            type: 'string',
          },
          jwtToken: {
            usage: 'Specify your jwtToken (for OPENID_CONNECT authType)',
            required: false,
            type: 'string',
          },
          apiKey: {
            usage: 'Specify your appsync api key (for API_KEY authType)',
            required: false,
            type: 'string',
          },
          port: {
            usage: 'Specify the local port graphql playground should run from',
            required: false,
            type: 'string',
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
      'appsync-domain': {
        usage: 'Manage the domain for this AppSync API',
        commands: {
          create: {
            usage: 'Create the domain in AppSync',
            lifecycleEvents: ['run'],
            options: {
              quiet: {
                usage: "Don't return an error if the domain already exists",
                shortcut: 'q',
                required: false,
                type: 'boolean',
              },
            },
          },
          delete: {
            usage: 'Delete the domain from AppSync',
            lifecycleEvents: ['run'],
            options: {
              quiet: {
                usage: "Don't return an error if the domain does not exist",
                shortcut: 'q',
                required: false,
                type: 'boolean',
              },
            },
          },
          'create-record': {
            usage: 'Create the CNAME record for this domain in Route53',
            lifecycleEvents: ['run'],
            options: {
              quiet: {
                usage: "Don't return an error if the record already exists",
                shortcut: 'q',
                required: false,
                type: 'boolean',
              },
            },
          },
          'delete-record': {
            usage: 'Deletes the CNAME record for this domain from Route53',
            lifecycleEvents: ['run'],
            options: {
              quiet: {
                usage: "Don't return an error if the record does not exist",
                shortcut: 'q',
                required: false,
                type: 'boolean',
              },
            },
          },
          assoc: {
            usage: 'Associate this AppSync API with the domain',
            lifecycleEvents: ['run'],
            options: {
              yes: {
                usage: 'Automatic yes to prompts',
                shortcut: 'y',
                required: false,
                type: 'boolean',
              },
            },
          },
          disassoc: {
            usage: 'Disassociate the AppSync API associated to the domain',
            lifecycleEvents: ['run'],
            options: {
              yes: {
                usage: 'Automatic yes to prompts',
                shortcut: 'y',
                required: false,
                type: 'boolean',
              },
              force: {
                usage: 'Force the disassociation of *any* API from this domain',
                shortcut: 'f',
                required: false,
                type: 'boolean',
              },
            },
          },
        },
      },
    };

    this.log = this.log.bind(this);

    const generateMigrationErrorMessage = (command) => () => {
      throw new this.serverless.classes.Error(
        `serverless-appsync: ${command} ` +
          `is no longer supported. See ${MIGRATION_DOCS} for more information`,
      );
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
      'after:aws:package:finalize:mergeCustomProviderResources': () =>
        this.addResources(),
      'after:aws:info:gatherData': () => this.gatherData(),
      'after:aws:info:displayEndpoints': () => this.displayEndpoints(),
      'after:aws:info:displayApiKeys': () => this.displayApiKeys(),
      'appsync-domain:create:run': async () => this.createDomain(),
      'appsync-domain:delete:run': async () => this.deleteDomain(),
      'appsync-domain:assoc:run': async () => this.assocDomain(),
      'appsync-domain:disassoc:run': async () => this.disassocDomain(),
      'appsync-domain:create-record:run': async () => this.createRecord(),
      'appsync-domain:delete-record:run': async () => this.deleteRecord(),
    };
  }

  log(message, options) {
    this.serverless.cli.log(message, 'AppSync Plugin', options);
  }

  getLambdaArn(config) {
    if (config && config.lambdaFunctionArn) {
      return config.lambdaFunctionArn;
    } else if (config && config.functionName) {
      return this.generateLambdaArn(config.functionName, config.functionAlias);
    }
    throw new Error(
      'You must specify either `lambdaFunctionArn` or `functionName` for lambda resolvers.',
    );
  }

  generateLambdaArn(functionName, functionAlias) {
    const lambdaLogicalId =
      this.provider.naming.getLambdaLogicalId(functionName);
    const lambdaArn = { 'Fn::GetAtt': [lambdaLogicalId, 'Arn'] };

    return functionAlias
      ? { 'Fn::Join': [':', [lambdaArn, functionAlias]] }
      : lambdaArn;
  }

  getDbClusterArn(config) {
    if (config && config.dbClusterIdentifier) {
      return this.generateDbClusterArn(
        config.dbClusterIdentifier,
        config.region,
      );
    }

    throw new Error(
      'You must specify either `dbClusterIdentifier` for the resolver.',
    );
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
        throw new Error(
          'You must specify `deltaSyncTableName` for Delta Sync configuration.',
        );
      }
      return {
        BaseTableTTL:
          typeof config.deltaSyncConfig.baseTableTTL === 'undefined'
            ? 0
            : config.deltaSyncConfig.baseTableTTL,
        DeltaSyncTableName: config.deltaSyncConfig.deltaSyncTableName,
        DeltaSyncTableTTL:
          typeof config.deltaSyncConfig.deltaSyncTableTTL === 'undefined'
            ? 60
            : config.deltaSyncConfig.deltaSyncTableTTL,
      };
    }

    throw new Error(
      'You must specify `deltaSyncConfig` for Delta Sync configuration.',
    );
  }

  gatherData() {
    const stackName = this.provider.naming.getStackName();

    return this.provider
      .request('CloudFormation', 'describeStacks', { StackName: stackName })
      .then((result) => {
        const outputs = result.Stacks[0].Outputs;
        outputs
          .filter((x) => x.OutputKey.match(new RegExp(`${RESOURCE_URL}$`)))
          .forEach((x) => {
            this.gatheredData.endpoints.push(x.OutputValue);
          });

        outputs
          .filter((x) => x.OutputKey.match(new RegExp(`^${RESOURCE_API_KEY}`)))
          .forEach((x) => {
            this.gatheredData.apiKeys.push(x.OutputValue);
          });
      });
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
      this.gatheredData.apiKeys.forEach((key) => {
        if (conceal) {
          apiKeysMessage += '\n  *** (concealed)';
        } else {
          apiKeysMessage += `\n  ${key}`;
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

  validateSchemas() {
    const config = this.loadConfig();

    const awsTypes = `
      directive @aws_iam on FIELD_DEFINITION | OBJECT
      directive @aws_oidc on FIELD_DEFINITION | OBJECT
      directive @aws_api_key on FIELD_DEFINITION | OBJECT
      directive @aws_lambda on FIELD_DEFINITION | OBJECT
      directive @aws_auth(cognito_groups: [String]) on FIELD_DEFINITION | OBJECT
      directive @aws_cognito_user_pools(
        cognito_groups: [String]
      ) on FIELD_DEFINITION | OBJECT

      directive @aws_subscribe(mutations: [String]) on FIELD_DEFINITION

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

    try {
      config.forEach((apiConfig) => {
        buildASTSchema(parseSchema(`${apiConfig.schema} ${awsTypes}`));
      });
      this.log('GraphQl schema valid');
    } catch (errors) {
      this.log(errors, { color: 'red' });
    }
  }

  deleteGraphQLEndpoint() {
    const config = this.loadConfig();
    return Promise.all(
      config.map((apiConfig) => {
        const { apiId } = apiConfig;
        if (!apiId) {
          throw new this.serverless.classes.Error(
            'serverless-appsync: no apiId is defined. If you are not ' +
              `migrating from a previous version of the plugin this is expected.  See ${MIGRATION_DOCS} '
        + 'for more information`,
          );
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
      }),
    );
  }

  runGraphqlPlayground() {
    // Use the first config or config map
    const firstConfig = this.loadConfig()[0];
    return runPlayground(this.provider, firstConfig, this.options)
      .then((url) => {
        this.log(`Graphql Playground Server Running at: ${url}`);
      })
      .then(() => new Promise(() => {}));
  }

  addResources() {
    const config = this.loadConfig();

    const resources =
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const outputs =
      this.serverless.service.provider.compiledCloudFormationTemplate.Outputs;

    config.forEach((apiConfig) => {
      this.addResource(resources, outputs, apiConfig);
    });
  }

  addResource(resources, outputs, apiConfig) {
    if (apiConfig.apiId) {
      this.log(`
          Updating an existing API endpoint: ${apiConfig.apiId}.
          The following configuration options are ignored:
            - name
            - authenticationType
            - userPoolConfig
            - openIdConnectConfig
            - additionalAuthenticationProviders
            - logConfig
            - tags
            - xrayEnabled
            - apiKeys
            - wafConfig
        `);
    } else {
      Object.assign(resources, this.getGraphQlApiEndpointResource(apiConfig));
      Object.assign(resources, this.getApiKeyResources(apiConfig));
      Object.assign(resources, this.getCloudWatchLogsRole(apiConfig));
      Object.assign(resources, this.getWafResources(apiConfig));
      Object.assign(outputs, this.getApiKeyOutputs(apiConfig));
    }
    Object.assign(resources, this.getApiCachingResource(apiConfig));
    Object.assign(resources, this.getGraphQLSchemaResource(apiConfig));
    Object.assign(resources, this.getDataSourceIamRolesResouces(apiConfig));
    Object.assign(resources, this.getDataSourceResources(apiConfig));
    Object.assign(resources, this.getFunctionConfigurationResources(apiConfig));
    Object.assign(resources, this.getResolverResources(apiConfig));
    Object.assign(outputs, this.getGraphQlApiOutputs(apiConfig));
  }

  getUserPoolConfig(provider, region) {
    const userPoolConfig = {
      AwsRegion: provider.userPoolConfig.awsRegion || region,
      UserPoolId: provider.userPoolConfig.userPoolId,
      AppIdClientRegex: provider.userPoolConfig.appIdClientRegex,
    };

    if (provider.userPoolConfig.defaultAction) {
      Object.assign(userPoolConfig, {
        DefaultAction: provider.userPoolConfig.defaultAction,
      });
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

  getLambdaAuthorizerConfig(provider) {
    const lambdaAuthorizerConfig = {
      AuthorizerUri: this.getLambdaArn(provider.lambdaAuthorizerConfig),
      IdentityValidationExpression:
        provider.lambdaAuthorizerConfig.identityValidationExpression,
      AuthorizerResultTtlInSeconds:
        provider.lambdaAuthorizerConfig.authorizerResultTtlInSeconds,
    };

    return lambdaAuthorizerConfig;
  }

  getTagsConfig(config) {
    return Object.keys(config.tags).map((key) => ({
      Key: key,
      Value: config.tags[key],
    }));
  }

  mapAuthenticationProvider(provider, region) {
    const { authenticationType } = provider;
    const Provider = {
      AuthenticationType: authenticationType,
      UserPoolConfig:
        authenticationType !== 'AMAZON_COGNITO_USER_POOLS'
          ? undefined
          : this.getUserPoolConfig(provider, region),
      OpenIDConnectConfig:
        authenticationType !== 'OPENID_CONNECT'
          ? undefined
          : this.getOpenIDConnectConfig(provider),
      LambdaAuthorizerConfig:
        authenticationType !== 'AWS_LAMBDA'
          ? undefined
          : this.getLambdaAuthorizerConfig(provider),
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
        throw new this.serverless.classes.Error(
          'userPoolConfig defaultAction is required',
        );
      } else if (
        ['ALLOW', 'DENY'].indexOf(config.userPoolConfig.defaultAction) === -1
      ) {
        throw new this.serverless.classes.Error(
          'userPoolConfig defaultAction must be either ALLOW or DENY',
        );
      }
    }

    return {
      [logicalIdGraphQLApi]: {
        Type: 'AWS::AppSync::GraphQLApi',
        Properties: {
          Name: config.name,
          AuthenticationType: config.authenticationType,
          AdditionalAuthenticationProviders:
            config.additionalAuthenticationProviders.map((provider) =>
              this.mapAuthenticationProvider(provider, config.region),
            ),
          UserPoolConfig:
            config.authenticationType !== 'AMAZON_COGNITO_USER_POOLS'
              ? undefined
              : this.getUserPoolConfig(config, config.region),
          LambdaAuthorizerConfig:
            config.authenticationType !== 'AWS_LAMBDA'
              ? undefined
              : this.getLambdaAuthorizerConfig(config),
          OpenIDConnectConfig:
            config.authenticationType !== 'OPENID_CONNECT'
              ? undefined
              : this.getOpenIDConnectConfig(config),
          LogConfig: !config.logConfig
            ? undefined
            : {
                CloudWatchLogsRoleArn: config.logConfig.loggingRoleArn || {
                  'Fn::GetAtt': [logicalIdCloudWatchLogsRole, 'Arn'],
                },
                FieldLogLevel: config.logConfig.level,
                ExcludeVerboseContent: config.logConfig.excludeVerboseContent,
              },
          XrayEnabled: config.xrayEnabled,
          Tags: !config.tags ? undefined : this.getTagsConfig(config),
        },
      },
      ...this.getLambdaAuthorizerPermission(config, logicalIdGraphQLApi),
      ...(config.logConfig &&
        config.logConfig.level && {
          [`${logicalIdGraphQLApi}LogGroup`]: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
              LogGroupName: {
                'Fn::Join': [
                  '/',
                  [
                    '/aws/appsync/apis',
                    { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
                  ],
                ],
              },
              RetentionInDays:
                this.serverless.service.provider.logRetentionInDays,
            },
          },
        }),
    };
  }

  getLambdaAuthorizerPermission(config, logicalIdGraphQLApi) {
    const lambdaConfig = [
      config,
      ...config.additionalAuthenticationProviders,
    ].find((e) => e.authenticationType === 'AWS_LAMBDA');

    return lambdaConfig
      ? {
          [`${logicalIdGraphQLApi}LambdaAuthorizerPermission`]: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
              Action: 'lambda:InvokeFunction',
              FunctionName: this.getLambdaArn(
                lambdaConfig.lambdaAuthorizerConfig,
              ),
              Principal: 'appsync.amazonaws.com',
              SourceArn: { Ref: logicalIdGraphQLApi },
            },
          },
        }
      : undefined;
  }

  hasApiKeyAuth(config) {
    if (
      config.authenticationType === 'API_KEY' ||
      config.additionalAuthenticationProviders.some(
        ({ authenticationType }) => authenticationType === 'API_KEY',
      )
    ) {
      return true;
    }
    return false;
  }

  getApiKeys(config) {
    if (!config.apiKeys) {
      return [
        {
          name: 'Default',
          description: 'Auto-generated api key',
        },
      ];
    }

    if (!Array.isArray(config.apiKeys)) {
      throw Error('apiKeys must be an array.');
    }

    let unnamedCount = 1;
    return config.apiKeys.map((item) => {
      let key = item;
      if (typeof key === 'string') {
        key = { name: key };
      }

      let { name } = key;
      if (!name) {
        name = `Key${unnamedCount}`;
        unnamedCount += 1;
      }

      return {
        ...key,
        name,
      };
    });
  }

  getApiKeyResources(config) {
    if (this.hasApiKeyAuth(config)) {
      const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
      const keys = this.getApiKeys(config);

      return keys.reduce((acc, key) => {
        const { name, expiresAt, expiresAfter, description, apiKeyId } = key;

        let expires;
        if (expiresAfter) {
          expires = moment
            .utc()
            .startOf('hour')
            .add(parseDuration(expiresAfter));
        } else if (expiresAt) {
          expires = moment.utc(expiresAt);
        } else {
          // 1 year by default
          expires = moment.utc().startOf('hour').add(365, 'days');
        }

        if (
          expires.isBefore(moment.utc().add(1, 'day')) ||
          expires.isAfter(moment.utc().add(1, 'year'))
        ) {
          throw new Error(
            `Api Key ${name} must be valid for a minimum of 1 day and a maximum of 365 days.`,
          );
        }

        const logicalIdApiKey = this.getLogicalId(
          config,
          RESOURCE_API_KEY + name,
        );
        acc[logicalIdApiKey] = {
          Type: 'AWS::AppSync::ApiKey',
          Properties: {
            ApiId: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
            Description: description || name,
            Expires: expires.unix(),
            ApiKeyId: apiKeyId,
          },
        };

        return acc;
      }, {});
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
            ApiId: config.apiId || {
              'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'],
            },
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
          Roles: [{ Ref: logicalIdCloudWatchLogsRole }],
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
                    'Fn::GetAtt': [logGroupResourceName, 'Arn'],
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
      // Only generate DataSource Roles if `serviceRoleArn` not provided
      if (ds.config && ds.config.serviceRoleArn) {
        return acc;
      }

      let statements;

      if (
        ds.type === 'HTTP' &&
        ds.config &&
        ds.config.authorizationConfig &&
        ds.config.authorizationConfig.authorizationType === 'AWS_IAM' &&
        !ds.config.iamRoleStatements
      ) {
        throw new Error(
          `${ds.name}: When using AWS_IAM signature, you must also specify the required iamRoleStatements`,
        );
      }

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

      const logicalIdDataSource = this.getLogicalId(
        config,
        `${this.getDataSourceCfnName(ds.name)}Role`,
      );
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
          Resource: [lambdaArn, { 'Fn::Join': [':', [lambdaArn, '*']] }],
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
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [
            ds.config.awsSecretStoreArn,
            { 'Fn::Join': [':', [ds.config.awsSecretStoreArn, '*']] },
          ],
        };

        defaultStatements.push(dbStatement, secretManagerStatement);
        break;
      }
      case 'AMAZON_ELASTICSEARCH':
      case 'AMAZON_OPENSEARCH_SERVICE': {
        let arn;
        if (ds.config.domain) {
          arn = {
            'Fn::Join': [
              '/',
              [{ 'Fn::GetAtt': [ds.config.domain, 'Arn'] }, '*'],
            ],
          };
        } else if (
          ds.config.endpoint &&
          typeof ds.config.endpoint === 'string'
        ) {
          const rx =
            /^https:\/\/([a-z0-9-]+\.\w{2}-[a-z]+-\d\.es\.amazonaws\.com)$/;
          const result = rx.exec(ds.config.endpoint);
          if (!result) {
            throw new this.serverless.classes.Error(
              `Invalid AWS OpenSearch/ElasticSearch endpoint: '${ds.config.endpoint}`,
            );
          }
          arn = {
            'Fn::Join': [
              ':',
              [
                'arn',
                'aws',
                'es',
                ds.config.region || config.region,
                { Ref: 'AWS::AccountId' },
                `domain/${result[1]}/*`,
              ],
            ],
          };
        } else {
          throw new this.serverless.classes.Error(
            `Could not determine the Arn for dataSource '${ds.name}`,
          );
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
          ApiId: config.apiId || {
            'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'],
          },
          Name: ds.name,
          Description: ds.description,
          Type: ds.type,
        },
      };

      // If a serviceRoleArn was given for this DataSource, use it
      if (ds.config && ds.config.serviceRoleArn) {
        resource.Properties.ServiceRoleArn = ds.config.serviceRoleArn;
      } else {
        const logicalIdDataSourceRole = this.getLogicalId(
          config,
          `${this.getDataSourceCfnName(ds.name)}Role`,
        );
        // If a Role Resource was generated for this DataSource, use it
        const resources =
          this.serverless.service.provider.compiledCloudFormationTemplate
            .Resources;
        const role = resources[logicalIdDataSourceRole];
        if (role) {
          resource.Properties.ServiceRoleArn = {
            'Fn::GetAtt': [logicalIdDataSourceRole, 'Arn'],
          };
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
            'Fn::Join': [
              '',
              [
                'https://',
                { 'Fn::GetAtt': [ds.config.domain, 'DomainEndpoint'] },
              ],
            ],
          },
        };
      } else if (ds.type === 'AMAZON_OPENSEARCH_SERVICE') {
        resource.Properties.OpenSearchServiceConfig = {
          AwsRegion: ds.config.region || config.region,
          Endpoint: ds.config.endpoint || {
            'Fn::Join': [
              '',
              [
                'https://',
                { 'Fn::GetAtt': [ds.config.domain, 'DomainEndpoint'] },
              ],
            ],
          },
        };
      } else if (ds.type === 'RELATIONAL_DATABASE') {
        resource.Properties.RelationalDatabaseConfig = {
          RdsHttpEndpointConfig: {
            AwsRegion: ds.config.region || config.region,
            DbClusterIdentifier: this.getDbClusterArn(
              Object.assign({}, ds.config, config),
            ),
            DatabaseName: ds.config.databaseName,
            Schema: ds.config.schema,
            AwsSecretStoreArn: ds.config.awsSecretStoreArn,
          },
          RelationalDatabaseSourceType:
            ds.config.relationalDatabaseSourceType || 'RDS_HTTP_ENDPOINT',
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
                  SigningRegion:
                    authConfig.awsIamConfig.signingRegion || config.region,
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
        throw new this.serverless.classes.Error(
          `Data Source Type not supported: ${ds.type}`,
        );
      }
      const logicalIdDataSource = this.getLogicalId(
        config,
        this.getDataSourceCfnName(ds.name),
      );
      return Object.assign({}, acc, { [logicalIdDataSource]: resource });
    }, {});
  }

  getGraphQLSchemaResource(config) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdGraphQLSchema = this.getLogicalId(config, RESOURCE_SCHEMA);
    const appSyncSafeSchema = this.cleanCommentsFromSchema(
      config.schema,
      config.allowHashDescription,
    );

    if (config.allowHashDescription) {
      this.log(
        'WARNING: allowing hash description is enabled, please be aware ENUM description is not supported in Appsync',
      );
    }

    return {
      [logicalIdGraphQLSchema]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: appSyncSafeSchema,
          ApiId: config.apiId || {
            'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'],
          },
        },
      },
    };
  }
  getFunctionConfigurationResources(config) {
    const flattenedFunctionConfigurationResources =
      config.functionConfigurations.reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        [],
      );
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
        ApiId: config.apiId || { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        Name: this.getCfnName(tpl.name),
        DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
        Description: tpl.description,
        FunctionVersion: '2018-05-29',
      };

      if (tpl.maxBatchSize) {
        Properties.MaxBatchSize = tpl.maxBatchSize;
      }

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
    const flattenedMappingTemplates = config.mappingTemplates.reduce(
      (accumulator, currentValue) => accumulator.concat(currentValue),
      [],
    );
    return flattenedMappingTemplates.reduce((acc, tpl) => {
      const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
      const logicalIdGraphQLSchema = this.getLogicalId(config, RESOURCE_SCHEMA);
      const logicalIdResolver = this.getLogicalId(
        config,
        `GraphQlResolver${this.getCfnName(tpl.type)}${this.getCfnName(
          tpl.field,
        )}`,
      );

      let Properties = {
        ApiId: config.apiId || { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        TypeName: tpl.type,
        FieldName: tpl.field,
      };

      if (tpl.maxBatchSize) {
        Properties.MaxBatchSize = tpl.maxBatchSize;
      }

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
          ...(tpl.sync.conflictHandler === 'LAMBDA'
            ? {
                LambdaConflictHandlerConfig: {
                  LambdaConflictHandlerArn: this.getLambdaArn(tpl.sync),
                },
              }
            : {}),
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
                `GraphQlFunctionConfiguration${this.getCfnName(
                  functionAttributeName,
                )}`,
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
              this.getLogicalId(
                config,
                this.getDataSourceCfnName(tpl.dataSource),
              ),
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

  getWafVisibilityConfig(visibilityConfig = {}, defaultName) {
    return merge(
      {
        CloudWatchMetricsEnabled: true,
        MetricName: defaultName,
        SampledRequestsEnabled: true,
      },
      toCfnKeys(visibilityConfig),
    );
  }

  getWafResources(apiConfig) {
    const { wafConfig } = apiConfig;
    if (!wafConfig || wafConfig.enabled === false) {
      return {};
    }

    const Name = wafConfig.name || `${apiConfig.name}Waf`;
    const apiLogicalId = this.getLogicalId(apiConfig, RESOURCE_API);
    const wafLogicalId = this.getLogicalId(apiConfig, RESOURCE_WAF);
    const wafAssocLogicalId = this.getLogicalId(apiConfig, RESOURCE_WAF_ASSOC);
    const defaultAction = wafConfig.defaultAction || 'Allow';

    return {
      [wafLogicalId]: {
        Type: 'AWS::WAFv2::WebACL',
        Properties: {
          DefaultAction: { [defaultAction]: {} },
          Scope: 'REGIONAL',
          Description:
            wafConfig.description || `ACL rules for AppSync ${apiConfig.name}`,
          Name,
          Rules: this.buildWafRules(wafConfig, apiConfig),
          VisibilityConfig: this.getWafVisibilityConfig(
            wafConfig.visibilityConfig,
            Name,
          ),
          Tags: !apiConfig.tags ? undefined : this.getTagsConfig(apiConfig),
        },
      },
      [wafAssocLogicalId]: {
        Type: 'AWS::WAFv2::WebACLAssociation',
        Properties: {
          ResourceArn: { 'Fn::GetAtt': [apiLogicalId, 'Arn'] },
          WebACLArn: { 'Fn::GetAtt': [wafLogicalId, 'Arn'] },
        },
      },
    };
  }

  buildApiKeysWafRules(config) {
    const apiKeysWithWafRules =
      this.getApiKeys(config).filter((k) => k.wafRules) || [];

    return apiKeysWithWafRules.reduce((acc, key) => {
      const rules = key.wafRules;
      // Build the rule and add a matching rule for the X-Api-Key header
      // for the given api key
      rules.forEach((keyRule) => {
        const builtRule = this.buildWafRule(keyRule, key.name);
        const logicalIdApiKey = this.getLogicalId(
          config,
          RESOURCE_API_KEY + key.name,
        );
        const { Statement: baseStatement } = builtRule;
        const ApiKeyStatement = {
          ByteMatchStatement: {
            FieldToMatch: {
              SingleHeader: { Name: 'X-Api-key' },
            },
            PositionalConstraint: 'EXACTLY',
            SearchString: { 'Fn::GetAtt': [logicalIdApiKey, 'ApiKey'] },
            TextTransformations: [
              {
                Type: 'LOWERCASE',
                Priority: 0,
              },
            ],
          },
        };

        let statement;
        if (baseStatement && baseStatement.RateBasedStatement) {
          let ScopeDownStatement;
          if (baseStatement.RateBasedStatement.ScopeDownStatement) {
            ScopeDownStatement = {
              AndStatement: {
                Statements: [
                  baseStatement.RateBasedStatement.ScopeDownStatement,
                  ApiKeyStatement,
                ],
              },
            };
          } else {
            ScopeDownStatement = ApiKeyStatement;
          }
          // RateBasedStatement
          statement = {
            RateBasedStatement: {
              ...baseStatement.RateBasedStatement,
              ScopeDownStatement,
            },
          };
        } else if (baseStatement) {
          // Other rules: combine them (And Statement)
          statement = {
            AndStatement: {
              Statements: [baseStatement, ApiKeyStatement],
            },
          };
        } else {
          // No statement, the rule is the API key rule itself
          statement = ApiKeyStatement;
        }

        acc.push({
          ...builtRule,
          Statement: statement,
        });
      });

      return acc;
    }, []);
  }

  buildWafRule(rule, defaultNamePrefix) {
    // Throttle pre-set rule
    if (rule === 'throttle' || rule.throttle) {
      return this.buildThrottleRule(rule.throttle || {}, defaultNamePrefix);
    }

    // Disable Introspection pre-set rule
    if (rule === 'disableIntrospection' || rule.disableIntrospection) {
      return this.buildDisableIntrospecRule(
        rule.disableIntrospection || {},
        defaultNamePrefix,
      );
    }

    // Other specific rules
    let action = rule.action || 'Allow'; // fixme, if group, should not be set
    if (typeof action === 'string') {
      action = { [action]: {} };
    }

    let { overrideAction } = rule;
    if (typeof overrideAction === 'string') {
      overrideAction = { [overrideAction]: {} };
    }

    const result = {
      Name: rule.name,
      Priority: rule.priority,
      Statement: rule.statement ? toCfnKeys(rule.statement) : undefined,
      VisibilityConfig: this.getWafVisibilityConfig(
        rule.visibilityConfig,
        rule.name,
      ),
    };
    // only one of Action or OverrideAction is allowed
    if (overrideAction) {
      result.OverrideAction = toCfnKeys(overrideAction);
    } else if (action) {
      result.Action = action;
    }
    return result;
  }

  buildWafRules(wafConfig, apiConfig) {
    const rules = wafConfig.rules || [];

    let defaultPriority = 100;
    return rules
      .map((rule) => this.buildWafRule(rule, 'Base'))
      .concat(this.buildApiKeysWafRules(apiConfig))
      .map((rule) => ({
        ...rule,
        // eslint-disable-next-line no-plusplus
        Priority: rule.Priority || defaultPriority++,
      }));
  }

  buildDisableIntrospecRule(config, defaultNamePrefix) {
    const Name = `${defaultNamePrefix}DisableIntrospection`;
    let Priority;

    if (typeof config === 'object') {
      Priority = config.priority || Priority;
    }

    return {
      Action: {
        Block: {},
      },
      Name,
      Priority,
      Statement: {
        ByteMatchStatement: {
          FieldToMatch: {
            Body: {},
          },
          PositionalConstraint: 'CONTAINS',
          SearchString: '__schema',
          TextTransformations: [
            {
              Type: 'COMPRESS_WHITE_SPACE',
              Priority: 0,
            },
          ],
        },
      },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        MetricName: Name,
        CloudWatchMetricsEnabled: true,
      },
    };
  }

  buildThrottleRule(config, defaultNamePrefix) {
    const Name = `${defaultNamePrefix}Throttle`;
    let Limit = 100;
    let AggregateKeyType = 'IP';
    let ForwardedIPConfig;
    let Priority;

    if (typeof config === 'number') {
      Limit = config;
    } else if (typeof config === 'object') {
      const cfnConfig = toCfnKeys(config);
      AggregateKeyType = cfnConfig.AggregateKeyType || AggregateKeyType;
      Limit = cfnConfig.Limit || Limit;
      // eslint-disable-next-line prefer-destructuring
      Priority = cfnConfig.Priority;
      if (AggregateKeyType === 'FORWARDED_IP') {
        ForwardedIPConfig = merge(
          {
            HeaderName: 'X-Forwarded-For',
            FallbackBehavior: 'MATCH',
          },
          cfnConfig.ForwardedIPConfig,
        );
      }
    }

    return {
      Action: {
        Block: {},
      },
      Name,
      Priority,
      Statement: {
        RateBasedStatement: {
          AggregateKeyType,
          Limit,
          ForwardedIPConfig,
        },
      },
      VisibilityConfig: {
        CloudWatchMetricsEnabled: true,
        MetricName: Name,
        SampledRequestsEnabled: true,
      },
    };
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
    return this.getCfnName(
      config.name[0].toUpperCase() + config.name.slice(1) + resourceType,
    );
  }

  getGraphQlApiOutputs(config) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdGraphQLApiUrlOutput = this.getLogicalId(
      config,
      RESOURCE_URL,
    );
    const logicalIdGraphQLApiIdOutput = this.getLogicalId(
      config,
      RESOURCE_API_ID,
    );
    const results = {
      [logicalIdGraphQLApiIdOutput]: {
        Value: config.apiId || { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        Export: {
          Name: {
            'Fn::Sub': `\${AWS::StackName}-${logicalIdGraphQLApiIdOutput}`,
          },
        },
      },
    };
    // output the URL if we are not updating a specific API endpoint
    if (!config.apiId) {
      results[[logicalIdGraphQLApiUrlOutput]] = {
        Value: { 'Fn::GetAtt': [logicalIdGraphQLApi, 'GraphQLUrl'] },
        Export: {
          Name: {
            'Fn::Sub': `\${AWS::StackName}-${logicalIdGraphQLApiUrlOutput}`,
          },
        },
      };
    }
    return results;
  }

  getApiKeyOutputs(config) {
    if (this.hasApiKeyAuth(config)) {
      const keys = this.getApiKeys(config);
      return keys.reduce((acc, { name }) => {
        const logicalIdApiKey = this.getLogicalId(
          config,
          RESOURCE_API_KEY + name,
        );
        acc[logicalIdApiKey] = {
          Value: { 'Fn::GetAtt': [logicalIdApiKey, 'ApiKey'] },
        };

        return acc;
      }, {});
    }
    return {};
  }

  cleanCommentsFromSchema(schema, allowHashDescription) {
    const newStyleDescription = /"""[^"]*"""\n/g; // appsync does not support the new style descriptions
    const oldStyleDescription = /#.*\n/g; // appysnc does not support old-style # comments in enums, so remove them all
    const joinInterfaces = / *& */g; // appsync does not support the standard '&', but the "unofficial" ',' join for interfaces
    if (allowHashDescription) {
      return schema
        .replace(newStyleDescription, '')
        .replace(joinInterfaces, ', ');
    }
    return schema
      .replace(newStyleDescription, '')
      .replace(oldStyleDescription, '')
      .replace(joinInterfaces, ', ');
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
      .filter((value) => templateVariables.indexOf(value) > -1)
      .filter((value, index, array) => array.indexOf(value) === index)
      .reduce(
        (accum, value) =>
          Object.assign(accum, { [value]: allSubstitutions[value] }),
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
      if (typeof substitutions[templateJoin[i]] !== 'undefined') {
        const subs = { [templateJoin[i]]: substitutions[templateJoin[i]] };
        templateJoin[i] = { 'Fn::Sub': [`\${${templateJoin[i]}}`, subs] };
      }
    }
    return { 'Fn::Join': ['', templateJoin] };
  }

  async getApiId() {
    const { StackResources } = await this.provider.request(
      'CloudFormation',
      'describeStackResources',
      {
        StackName: this.provider.naming.getStackName(),
      },
    );

    const api = StackResources.find(
      (resource) => resource.ResourceType === 'AWS::AppSync::GraphQLApi',
    );

    if (!api) {
      throw new this.serverless.classes.Error(
        'AppSync Api not found in stack. Did you forget to deploy?',
      );
    }

    return last(api.PhysicalResourceId.split('/'));
  }

  getDomain() {
    const config = this.loadConfig();
    const { domain } = config[0];

    if (!domain) {
      throw new this.serverless.classes.Error('Domain configuration not found');
    }

    return domain;
  }

  async createDomain() {
    try {
      const domain = this.getDomain();
      await this.provider.request('AppSync', 'createDomainName', {
        domainName: domain.name,
        certificateArn: domain.certificateArn,
      });
      this.log(`Domain '${domain.name}' created successfully`, {
        color: 'green',
      });
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        this.options.quiet
      ) {
        this.log(error.message, { color: 'red' });
      } else {
        throw error;
      }
    }
  }

  async deleteDomain() {
    try {
      const domain = this.getDomain();
      this.log(`The domain '${domain.name} will be deleted.`);
      if (!this.options.yes && !(await confirmAction())) {
        return;
      }
      await this.provider.request('AppSync', 'deleteDomainName', {
        domainName: domain.name,
      });
      this.log(`Domain '${domain.name}' deleted successfully`, {
        color: 'green',
      });
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        this.options.quiet
      ) {
        this.log(error.message, { color: 'red' });
      } else {
        throw error;
      }
    }
  }

  async getApiAssocStatus(name) {
    try {
      const result = await this.provider.request(
        'AppSync',
        'getApiAssociation',
        {
          domainName: name,
        },
      );
      return result.apiAssociation;
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        error.providerErrorCodeExtension === 'NOT_FOUND_EXCEPTION'
      ) {
        return { associationStatus: 'NOT_FOUND' };
      }
      throw error;
    }
  }

  async showApiAssocStatus({ name, message, desiredStatus }) {
    this.log(message);
    let status;
    do {
      const result = await this.getApiAssocStatus(name);
      status = result.associationStatus || 'UNKNOWN';
      if (status !== desiredStatus) {
        await wait(1000);
        process.stdout.write('.');
      }
    } while (status !== desiredStatus);
    process.stdout.write('\n');
  }

  async assocDomain() {
    const domain = this.getDomain();
    const apiId = await this.getApiId();
    const assoc = await this.getApiAssocStatus(domain.name);

    if (assoc.associationStatus !== 'NOT_FOUND' && assoc.apiId !== apiId) {
      this.log(
        `The domain ${domain.name} is currently associated to another API (${assoc.apiId})`,
        { color: 'orange' },
      );
      if (!this.options.yes && !(await confirmAction())) {
        return;
      }
    } else if (assoc.apiId === apiId) {
      this.log('The domain is already associated to this API', {
        color: 'green',
      });
      return;
    }

    await this.provider.request('AppSync', 'associateApi', {
      domainName: domain.name,
      apiId,
    });

    const message = `Associating API with domain '${domain.name}'`;
    await this.showApiAssocStatus({
      name: domain.name,
      message,
      desiredStatus: 'SUCCESS',
    });
    this.log(`API successfully associated to domain '${domain.name}'`, {
      color: 'green',
    });
  }

  async disassocDomain() {
    const domain = this.getDomain();
    const apiId = await this.getApiId();
    const assoc = await this.getApiAssocStatus(domain.name);

    if (assoc.associationStatus === 'NOT_FOUND') {
      this.log(
        `The domain ${domain.name} is currently not associated to any API`,
      );
      return;
    }

    if (assoc.apiId !== apiId && !this.options.force) {
      throw new this.serverless.classes.Error(
        `The domain ${domain.name} is currently associated to another API (${assoc.apiId})\n` +
          `Try running this command from that API's stack or stage, or use the --force / -f flag`,
      );
    }
    this.log(
      `The domain ${domain.name} will be disassociated from API '${apiId}'`,
    );

    if (!this.options.yes && !(await confirmAction())) {
      return;
    }

    await this.provider.request('AppSync', 'disassociateApi', {
      domainName: domain.name,
    });

    const message = `Disassociating API from domain '${domain.name}'`;
    await this.showApiAssocStatus({
      name: domain.name,
      message,
      desiredStatus: 'NOT_FOUND',
    });

    this.log(`API successfully disassociated from domain '${domain.name}'`, {
      color: 'green',
    });
  }

  async getHostedZoneId() {
    const domain = this.getDomain();
    if (typeof domain.route53 === 'object' && domain.route53.hostedZoneId) {
      return domain.route53.hostedZoneId;
    } else {
      const { HostedZones } = await this.provider.request(
        'Route53',
        'listHostedZonesByName',
        {},
      );
      const hostedZoneName =
        typeof domain.route53 === 'object' && domain.route53.hostedZoneName
          ? domain.route53.hostedZoneName
          : getHostedZoneName(domain.name);
      const foundHostedZone = HostedZones.find(
        (zone) => zone.Name === hostedZoneName,
      ).Id;
      if (!foundHostedZone) {
        throw new this.serverless.classes.Error(
          `No hosted zone found for domain ${domain.name}`,
        );
      }
      return foundHostedZone.replace('/hostedzone/', '');
    }
  }

  async getAppSyncDomainName() {
    const domain = this.getDomain();
    const { domainNameConfig } = await this.provider.request(
      'AppSync',
      'getDomainName',
      {
        domainName: domain.name,
      },
    );
    const { appsyncDomainName } = domainNameConfig || {};
    if (!appsyncDomainName) {
      throw new this.serverless.classes.Error(
        `Domain ${domain.name} not found\nDid you forget to run 'sls appsync domain create'?`,
      );
    }

    return appsyncDomainName;
  }

  async createRecord() {
    this.log('Creating route53 record');

    const domain = this.getDomain();
    const appsyncDomainName = await this.getAppSyncDomainName();
    const hostedZoneId = await this.getHostedZoneId();
    const changeId = await this.changeRoute53Record(
      'CREATE',
      hostedZoneId,
      appsyncDomainName,
    );
    if (changeId) {
      await this.checkRoute53RecordStatus(changeId);
      this.log(
        `CNAME record '${domain.name}' with value '${appsyncDomainName}' was created in Hosted Zone '${hostedZoneId}'`,
      );
      this.log('Route53 record created successfuly', { color: 'green' });
    }
  }

  async deleteRecord() {
    const domain = this.getDomain();
    const appsyncDomainName = await this.getAppSyncDomainName();
    const hostedZoneId = await this.getHostedZoneId();

    this.log(
      `CNAME record '${domain.name}' with value '${appsyncDomainName}' will be deleted from Hosted Zone '${hostedZoneId}'`,
    );
    if (!this.options.yes && !(await confirmAction())) {
      return;
    }

    this.log('Deleting route53 record');

    const changeId = await this.changeRoute53Record(
      'DELETE',
      hostedZoneId,
      appsyncDomainName,
    );
    if (changeId) {
      await this.checkRoute53RecordStatus(changeId);
      this.log(
        `CNAME record '${domain.name}' with value '${appsyncDomainName}' was deleted from Hosted Zone '${hostedZoneId}'`,
      );
      this.log('Route53 record deleted successfuly', { color: 'green' });
    }
  }

  async checkRoute53RecordStatus(changeId) {
    let result;
    do {
      result = await this.provider.request('Route53', 'getChange', {
        Id: changeId,
      });
      if (result.ChangeInfo.Status !== 'INSYNC') {
        await wait(1000);
        process.stdout.write('.');
      }
    } while (result.ChangeInfo.Status !== 'INSYNC');
    process.stdout.write('\n');
  }

  async changeRoute53Record(action, hostedZoneId, cname) {
    const domain = this.getDomain();

    try {
      const { ChangeInfo } = await this.provider.request(
        'Route53',
        'changeResourceRecordSets',
        {
          HostedZoneId: hostedZoneId,
          ChangeBatch: {
            Changes: [
              {
                Action: action,
                ResourceRecordSet: {
                  Name: domain.name,
                  Type: 'CNAME',
                  ResourceRecords: [{ Value: cname }],
                  TTL: 300,
                },
              },
            ],
          },
        },
      );

      return ChangeInfo.Id;
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        this.options.quiet
      ) {
        this.log(error.message, { color: 'red' });
      } else {
        throw error;
      }
    }
  }
}

module.exports = ServerlessAppsyncPlugin;

import fs from 'fs';
import path from 'path';
import { getConfig } from './get-config';
import chalk from 'chalk';
import { has, isEmpty } from 'ramda';
import { merge } from 'lodash';
import { logger, parseDuration, toCfnKeys } from './utils';
import moment from 'moment';
import {
  CommandsDefinition,
  Hook,
  Provider,
  Serverless,
  ServerlessHelpers,
  ServerlessLogger,
} from 'types/serverless';
import {
  CfnDataSource,
  FnJoin,
  CfnFunctionResolver,
  CfnResolver,
  ApiKeyConfig,
  WafRule,
  WafThrottleConfig,
  DsRelationalDbConfig,
  IntrinsictFunction,
  DataSource,
  Auth,
  AppSyncConfig,
  LambdaConfig,
  CognitoAuth,
  OidcAuth,
  LambdaAuth,
  CfnApiKey,
  DsDynamoDBConfig,
  FunctionConfig,
  Resolver,
  WafAction,
  WafConfig,
  CfnWafAction,
  CfnWafRule,
  CfnWafRuleStatement,
  IamStatement,
  WafRuleDisableIntrospection,
} from './types';
import type {
  DescribeStacksInput,
  DescribeStacksOutput,
} from 'aws-sdk/clients/cloudformation';
import { convertAppSyncSchemas } from 'appsync-schema-converter';

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
  private provider: Provider;
  private gatheredData: {
    endpoints: string[];
    apiKeys: string[];
  };
  public readonly hooks: Record<string, Hook>;
  public readonly commands?: CommandsDefinition;
  private config?: AppSyncConfig[];
  private log: ServerlessLogger;

  constructor(
    private serverless: Serverless,
    private options: Record<string, string>,
    helpers?: ServerlessHelpers,
  ) {
    this.gatheredData = {
      endpoints: [],
      apiKeys: [],
    };
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.commands = {
      'validate-schema': {
        usage: 'Validates your graphql schema',
        lifecycleEvents: ['run'],
      },
    };

    this.log = helpers?.log || logger(serverless.cli.log);

    this.hooks = {
      'package:initialize': async () => {
        await this.loadConfig();
      },
      'validate-schema:run': () => this.validateSchemas(),
      'after:package:compileEvents': () => this.addResources(),
      'after:aws:info:gatherData': () => this.gatherData(),
      'after:aws:info:displayEndpoints': () => this.displayEndpoints(),
      'after:aws:info:displayApiKeys': () => this.displayApiKeys(),
    };
  }

  getLambdaArn(config: LambdaConfig) {
    if (config && has('lambdaFunctionArn', config)) {
      return config.lambdaFunctionArn;
    } else if (config && has('functionName', config)) {
      return this.generateLambdaArn(config.functionName, config.functionAlias);
    }
    throw new Error(
      'You must specify either `lambdaFunctionArn` or `functionName` for lambda resolvers.',
    );
  }

  generateLambdaArn(
    functionName: string,
    functionAlias?: string,
  ): IntrinsictFunction {
    const lambdaLogicalId =
      // @ts-ignore
      this.provider.naming.getLambdaLogicalId(functionName);
    const lambdaArn = { 'Fn::GetAtt': [lambdaLogicalId, 'Arn'] };

    return functionAlias
      ? { 'Fn::Join': [':', [lambdaArn, functionAlias]] }
      : lambdaArn;
  }

  getDbClusterArn(config: DsRelationalDbConfig['config']) {
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

  generateDbClusterArn(
    dbClusterIdentifier: string | IntrinsictFunction,
    region: string | IntrinsictFunction,
  ): FnJoin {
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

  getDeltaSyncConfig(config: DsDynamoDBConfig['config']) {
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

  async gatherData() {
    // @ts-ignore
    const stackName = this.provider.naming.getStackName();
    // @ts-ignore
    const result = await this.provider.request<
      DescribeStacksInput,
      DescribeStacksOutput
    >('CloudFormation', 'describeStacks', { StackName: stackName });

    const outputs = result.Stacks?.[0].Outputs;
    if (outputs) {
      outputs
        .filter((x) => x.OutputKey?.match(new RegExp(`${RESOURCE_URL}$`)))
        .forEach((x) => {
          if (x.OutputValue) {
            this.gatheredData.endpoints.push(x.OutputValue);
          }
        });

      outputs
        .filter((x) => x.OutputKey?.match(new RegExp(`^${RESOURCE_API_KEY}`)))
        .forEach((x) => {
          if (x.OutputValue) {
            this.gatheredData.apiKeys.push(x.OutputValue);
          }
        });
    }
  }

  displayEndpoints() {
    if (this.gatheredData.endpoints.length === 0) {
      return;
    }

    if (this.serverless.addServiceOutputSection) {
      this.serverless.addServiceOutputSection(
        'AppSync Endpoints',
        this.gatheredData.endpoints,
      );
    } else {
      let endpointsMessage = `${chalk.yellow('appsync endpoints:')}`;
      if (this.gatheredData.endpoints && this.gatheredData.endpoints.length) {
        this.gatheredData.endpoints.forEach((endpoint) => {
          endpointsMessage += `\n  ${endpoint}`;
        });
      } else {
        endpointsMessage += '\n  None';
      }

      this.log.info(endpointsMessage);
    }
  }

  displayApiKeys() {
    if (this.gatheredData.apiKeys.length === 0) {
      return;
    }

    const { conceal } = this.options;

    if (this.serverless.addServiceOutputSection) {
      if (!conceal) {
        this.serverless.addServiceOutputSection(
          'AppSync API keys',
          this.gatheredData.apiKeys,
        );
      }
    } else {
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

      this.log.info(apiKeysMessage);
    }
  }

  async loadConfig() {
    if (!this.serverless.configurationInput.custom.appSync) {
      throw new this.serverless.classes.Error('AppSync config not found');
    }
    this.config = await getConfig(
      this.serverless.configurationInput.custom.appSync,
      this.serverless.service.provider,
      this.serverless.config.servicePath,
    );
  }

  async validateSchemas() {
    try {
      this.log.info('Validating schema');
      // Loading the config already validates the schema
      await this.loadConfig();
      this.log.info('GraphQL schema valid');
    } catch (error) {
      this.log.error('GraphQL schema invalid');
      throw error;
    }
  }

  addResources() {
    this.config?.forEach((apiConfig) => {
      this.addResource(apiConfig);
    });
  }

  addResource(apiConfig: AppSyncConfig) {
    if (apiConfig.apiId) {
      this.log.info(`
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
      merge(this.serverless.service, {
        resources: { Resources: this.getGraphQlApiEndpointResource(apiConfig) },
      });
      merge(this.serverless.service, {
        resources: { Resources: this.getApiKeyResources(apiConfig) },
      });
      merge(this.serverless.service, {
        resources: { Resources: this.getCloudWatchLogsRole(apiConfig) },
      });
      merge(this.serverless.service, {
        resources: { Resources: this.getWafResources(apiConfig) },
      });
      merge(this.serverless.service, {
        resources: { Outputs: this.getApiKeyOutputs(apiConfig) },
      });
    }
    merge(this.serverless.service, {
      resources: { Resources: this.getApiCachingResource(apiConfig) },
    });
    merge(this.serverless.service, {
      resources: { Resources: this.getGraphQLSchemaResource(apiConfig) },
    });
    merge(this.serverless.service, {
      resources: { Resources: this.getDataSourceIamRolesResouces(apiConfig) },
    });
    merge(this.serverless.service, {
      resources: { Resources: this.getDataSourceResources(apiConfig) },
    });
    merge(this.serverless.service, {
      resources: {
        Resources: this.getFunctionConfigurationResources(apiConfig),
      },
    });
    merge(this.serverless.service, {
      resources: { Resources: this.getResolverResources(apiConfig) },
    });
    merge(this.serverless.service, {
      resources: { Outputs: this.getGraphQlApiOutputs(apiConfig) },
    });
  }

  getUserPoolConfig(config: CognitoAuth, region: string) {
    const userPoolConfig = {
      AwsRegion: config.userPoolConfig.awsRegion || region,
      UserPoolId: config.userPoolConfig.userPoolId,
      AppIdClientRegex: config.userPoolConfig.appIdClientRegex,
    };

    if (config.userPoolConfig.defaultAction) {
      Object.assign(userPoolConfig, {
        DefaultAction: config.userPoolConfig.defaultAction,
      });
    }

    return userPoolConfig;
  }

  getOpenIDConnectConfig(provider: OidcAuth) {
    if (!provider.openIdConnectConfig) {
      return;
    }

    const openIdConnectConfig = {
      Issuer: provider.openIdConnectConfig.issuer,
      ClientId: provider.openIdConnectConfig.clientId,
      IatTTL: provider.openIdConnectConfig.iatTTL,
      AuthTTL: provider.openIdConnectConfig.authTTL,
    };

    return openIdConnectConfig;
  }

  getLambdaAuthorizerConfig(provider: LambdaAuth) {
    if (!provider.lambdaAuthorizerConfig) {
      return;
    }

    const lambdaAuthorizerConfig = {
      AuthorizerUri: this.getLambdaArn(provider.lambdaAuthorizerConfig),
      IdentityValidationExpression:
        provider.lambdaAuthorizerConfig.identityValidationExpression,
      AuthorizerResultTtlInSeconds:
        provider.lambdaAuthorizerConfig.authorizerResultTtlInSeconds,
    };

    return lambdaAuthorizerConfig;
  }

  getTagsConfig(config: AppSyncConfig) {
    if (!config.tags) {
      return [];
    }

    const tags = config.tags;
    return Object.keys(config.tags).map((key) => ({
      Key: key,
      Value: tags[key],
    }));
  }

  mapAuthenticationProvider(provider: Auth, region: string) {
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

  getGraphQlApiEndpointResource(config: AppSyncConfig) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdCloudWatchLogsRole = this.getLogicalId(
      config,
      RESOURCE_API_CLOUDWATCH_LOGS_ROLE,
    );

    if (config.authenticationType === 'AMAZON_COGNITO_USER_POOLS') {
      if (!config.userPoolConfig.defaultAction) {
        throw new Error('userPoolConfig defaultAction is required');
      } else if (
        ['ALLOW', 'DENY'].indexOf(config.userPoolConfig.defaultAction) === -1
      ) {
        throw new Error(
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
            config.additionalAuthenticationProviders?.map((provider) =>
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
                // @ts-ignore
                this.serverless.service.provider.logRetentionInDays,
            },
          },
        }),
    };
  }

  getLambdaAuthorizerPermission(
    config: AppSyncConfig,
    logicalIdGraphQLApi: string,
  ) {
    // @ts-ignore
    const lambdaConfig: LambdaAuth = [
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

  hasApiKeyAuth(config: AppSyncConfig) {
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

  getApiKeys(config: AppSyncConfig): ApiKeyConfig[] {
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

  getApiKeyResources(config: AppSyncConfig): Record<string, CfnApiKey> {
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
      }, {} as Record<string, CfnApiKey>);
    }
    return {};
  }

  getApiCachingResource(config: AppSyncConfig) {
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

  getCloudWatchLogsRole(config: AppSyncConfig) {
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

  getDataSourceIamRolesResouces(config: AppSyncConfig) {
    return config.dataSources.reduce((acc, ds) => {
      // Only generate DataSource Roles if `serviceRoleArn` not provided
      if (has('config', ds) && ds.config.serviceRoleArn) {
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

      if (has('config', ds) && ds.config.iamRoleStatements) {
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

  getDefaultDataSourcePolicyStatements(ds: DataSource, config: AppSyncConfig) {
    const defaultStatements: IamStatement[] = [];

    switch (ds.type) {
      case 'AWS_LAMBDA': {
        const lambdaArn = this.getLambdaArn(ds.config);

        // Allow "invoke" for the Datasource's function and its aliases/versions
        const defaultLambdaStatement: IamStatement = {
          Action: ['lambda:invokeFunction'],
          Effect: 'Allow',
          Resource: [lambdaArn, { 'Fn::Join': [':', [lambdaArn, '*']] }],
        };

        defaultStatements.push(defaultLambdaStatement);
        break;
      }
      case 'AMAZON_DYNAMODB': {
        const dynamoDbResourceArn: IntrinsictFunction = {
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
        const defaultDynamoDBStatement: IamStatement = {
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
        const dDbResourceArn: IntrinsictFunction = {
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
        const dbStatement: IamStatement = {
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

        const secretManagerStatement: IamStatement = {
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
      case 'AMAZON_ELASTICSEARCH': {
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
            throw new Error(
              `Invalid AWS ElasticSearch endpoint: '${ds.config.endpoint}`,
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
          throw new Error(
            `Could not determine the Arn for dataSource '${ds.name}`,
          );
        }

        // Allow any action on the Datasource's ES endpoint
        const defaultESStatement: IamStatement = {
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

  getDataSourceResources(config: AppSyncConfig) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    return config.dataSources.reduce((acc, ds) => {
      const resource: CfnDataSource = {
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
      if (has('config', ds) && ds.config.serviceRoleArn) {
        resource.Properties.ServiceRoleArn = ds.config.serviceRoleArn;
      } else {
        const logicalIdDataSourceRole = this.getLogicalId(
          config,
          `${this.getDataSourceCfnName(ds.name)}Role`,
        );
        // If a Role Resource was generated for this DataSource, use it
        const resources = this.serverless.service.resources?.Resources;
        const role = resources?.[logicalIdDataSourceRole];
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
        // FIXME: take validation elsewhere
        // @ts-ignore
        throw new Error(`Data Source Type not supported: ${ds.type}`);
      }
      const logicalIdDataSource = this.getLogicalId(
        config,
        this.getDataSourceCfnName(ds.name),
      );
      return Object.assign({}, acc, { [logicalIdDataSource]: resource });
    }, {});
  }

  getGraphQLSchemaResource(config: AppSyncConfig) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdGraphQLSchema = this.getLogicalId(config, RESOURCE_SCHEMA);
    const appSyncSafeSchema = this.cleanCommentsFromSchema(
      config.schema,
      config.allowHashDescription,
    );

    if (config.allowHashDescription) {
      this.log.info(
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
  getFunctionConfigurationResources(
    config: AppSyncConfig,
  ): CfnFunctionResolver {
    const flattenedFunctionConfigurationResources =
      config.functionConfigurations.reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        [] as FunctionConfig[],
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

      const Properties: CfnFunctionResolver['Properties'] = {
        ApiId: config.apiId || { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        Name: this.getCfnName(tpl.name),
        DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
        Description: tpl.description,
        FunctionVersion: '2018-05-29',
      };

      const requestTemplate = has('request')(tpl)
        ? tpl.request
        : config.defaultMappingTemplates?.request;
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
        : config.defaultMappingTemplates?.response;
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
    }, {} as CfnFunctionResolver);
  }

  getResolverResources(config: AppSyncConfig): CfnResolver {
    const flattenedMappingTemplates: Resolver[] =
      config.mappingTemplates.reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        [] as Resolver[],
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

      let Properties: CfnResolver['Properties'] = {
        ApiId: config.apiId || { 'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'] },
        TypeName: tpl.type,
        FieldName: tpl.field,
      };

      const requestTemplate = has('request')(tpl)
        ? tpl.request
        : config.defaultMappingTemplates?.request;
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
        : config.defaultMappingTemplates?.response;
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
    }, {} as CfnResolver);
  }

  // FIXME: type of visibilityConfig
  getWafVisibilityConfig(
    visibilityConfig: Record<string, unknown> | undefined = {},
    defaultName: string,
  ) {
    return merge(
      {
        CloudWatchMetricsEnabled: true,
        MetricName: defaultName,
        SampledRequestsEnabled: true,
      },
      toCfnKeys(visibilityConfig),
    );
  }

  getWafResources(apiConfig: AppSyncConfig) {
    const { wafConfig } = apiConfig;
    if (!wafConfig || wafConfig.enabled === false) {
      return {};
    }

    const Name = wafConfig.name || `${apiConfig.name}Waf`;
    const apiLogicalId = this.getLogicalId(apiConfig, RESOURCE_API);
    const wafLogicalId = this.getLogicalId(apiConfig, RESOURCE_WAF);
    const wafAssocLogicalId = this.getLogicalId(apiConfig, RESOURCE_WAF_ASSOC);
    const defaultActionSource = wafConfig.defaultAction || 'Allow';
    const defaultAction: CfnWafAction =
      typeof defaultActionSource === 'string'
        ? { [defaultActionSource]: {} }
        : defaultActionSource;

    return {
      [wafLogicalId]: {
        Type: 'AWS::WAFv2::WebACL',
        Properties: {
          DefaultAction: defaultAction,
          Scope: 'REGIONAL',
          Description:
            wafConfig.description || `ACL rules for AppSync ${apiConfig.name}`,
          Name,
          Rules: this.buildWafRules(wafConfig, apiConfig),
          VisibilityConfig: this.getWafVisibilityConfig(
            wafConfig.visibilityConfig,
            Name,
          ),
          Tags: apiConfig.tags,
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

  buildApiKeysWafRules(config: AppSyncConfig): CfnWafRule[] {
    const apiKeysWithWafRules =
      this.getApiKeys(config).filter((k) => k.wafRules) || [];

    return apiKeysWithWafRules.reduce((acc, key) => {
      const rules = key.wafRules;
      // Build the rule and add a matching rule for the X-Api-Key header
      // for the given api key
      rules?.forEach((keyRule) => {
        const builtRule = this.buildWafRule(keyRule, key.name);
        const logicalIdApiKey = this.getLogicalId(
          config,
          RESOURCE_API_KEY + key.name,
        );
        const { Statement: baseStatement } = builtRule;
        const ApiKeyStatement: CfnWafRuleStatement = {
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

        let statement: CfnWafRuleStatement;
        if (baseStatement && baseStatement?.RateBasedStatement) {
          let ScopeDownStatement: CfnWafRuleStatement;
          if (baseStatement.RateBasedStatement?.ScopeDownStatement) {
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
        } else if (!isEmpty(baseStatement)) {
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
    }, [] as CfnWafRule[]);
  }

  buildWafRule(rule: WafRule, defaultNamePrefix?: string): CfnWafRule {
    // Throttle pre-set rule
    if (rule === 'throttle') {
      return this.buildThrottleRule({}, defaultNamePrefix);
    } else if (has('throttle')(rule)) {
      return this.buildThrottleRule(rule.throttle, defaultNamePrefix);
    }

    // Disable Introspection pre-set rule
    if (rule === 'disableIntrospection') {
      return this.buildDisableIntrospecRule({}, defaultNamePrefix);
    } else if (has('disableIntrospection')(rule)) {
      return this.buildDisableIntrospecRule(
        rule.disableIntrospection,
        defaultNamePrefix,
      );
    }

    // Other specific rules
    let action: WafAction = rule.action || 'Allow'; // fixme, if group, should not be set
    if (typeof action === 'string') {
      action = { [action]: {} };
    }

    let { overrideAction } = rule;
    if (typeof overrideAction === 'string') {
      overrideAction = { [overrideAction]: {} };
    }

    const result: CfnWafRule = {
      Name: rule.name,
      Priority: rule.priority,
      Statement: toCfnKeys(rule.statement),
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

  buildWafRules(wafConfig: WafConfig, apiConfig: AppSyncConfig) {
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

  buildDisableIntrospecRule(
    config: WafRuleDisableIntrospection['disableIntrospection'],
    defaultNamePrefix?: string,
  ): CfnWafRule {
    const Name = `${defaultNamePrefix}DisableIntrospection`;

    return {
      Action: {
        Block: {},
      },
      Name,
      Priority: config.priority,
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

  buildThrottleRule(
    config: WafThrottleConfig,
    defaultNamePrefix?: string,
  ): CfnWafRule {
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

  getLogicalId(config: AppSyncConfig, resourceType: string): string {
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

  getGraphQlApiOutputs(config: AppSyncConfig) {
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
      results[logicalIdGraphQLApiUrlOutput] = {
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

  getApiKeyOutputs(config: AppSyncConfig) {
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
      }, {} as Record<string, { Value: IntrinsictFunction }>);
    }
    return {};
  }

  cleanCommentsFromSchema(schema: string, allowHashDescription?: boolean) {
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

  getCfnName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  getDataSourceCfnName(name: string) {
    return `GraphQlDs${this.getCfnName(name)}`;
  }

  processTemplate(
    template: string,
    config: AppSyncConfig,
    tplSubstitutions?: Record<string, string | IntrinsictFunction>,
  ): string | IntrinsictFunction {
    // TODO use serverless variable parser and serverless variable syntax config
    const variableSyntax = RegExp(/\${([\w\d-_]+)}/g);
    const allSubstitutions = { ...config.substitutions, ...tplSubstitutions };
    const configVariables = Object.keys(allSubstitutions);
    const templateVariables: string[] = [];
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
  substituteGlobalTemplateVariables(
    template: string,
    substitutions: Record<string, string | IntrinsictFunction>,
  ): IntrinsictFunction {
    const variables = Object.keys(substitutions).join('|');
    const regex = new RegExp(`\\\${(${variables})}`, 'g');
    const substituteTemplate = template.replace(regex, '|||$1|||');

    const templateJoin = substituteTemplate.split('|||');
    const parts: (string | IntrinsictFunction)[] = [];
    for (let i = 0; i < templateJoin.length; i += 1) {
      if (typeof substitutions[templateJoin[i]] !== 'undefined') {
        const subs = { [templateJoin[i]]: substitutions[templateJoin[i]] };
        parts[i] = { 'Fn::Sub': [`\${${templateJoin[i]}}`, subs] };
      } else {
        parts[i] = templateJoin[i];
      }
    }
    return { 'Fn::Join': ['', parts] };
  }
}

export = ServerlessAppsyncPlugin;

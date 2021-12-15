import fs from 'fs';
import path from 'path';
import { AppSyncConfigInput, getAppSyncConfig } from './get-config';
import chalk from 'chalk';
import { has, isEmpty } from 'ramda';
import { merge } from 'lodash';
import { logger, toCfnKeys } from './utils';
import {
  CommandsDefinition,
  Hook,
  Provider,
  Serverless,
  ServerlessHelpers,
  ServerlessLogger,
} from 'types/serverless';
import {
  WafRule,
  WafThrottleConfig,
  DataSourceConfig,
  Auth,
  AppSyncConfig,
  LambdaConfig,
  CognitoAuth,
  OidcAuth,
  LambdaAuth,
  ResolverConfig,
  WafAction,
  WafConfig,
  IamStatement,
  WafRuleDisableIntrospection,
  ApiKeyConfigObject,
} from './types/plugin';
import type {
  DescribeStacksInput,
  DescribeStacksOutput,
} from 'aws-sdk/clients/cloudformation';
import {
  IntrinsictFunction,
  CfnResolver,
  CfnWafAction,
  CfnWafRule,
  CfnWafRuleStatement,
} from 'types/cloudFormation';
import { Api } from './resources/Api';

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
  private config: AppSyncConfigInput[];
  private log: ServerlessLogger;
  private apis: Api[] = [];

  constructor(
    public serverless: Serverless,
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

    if (!this.serverless.configurationInput.custom.appSync) {
      throw new Error('AppSync config is not defined');
    }

    const config = this.serverless.configurationInput.custom.appSync;
    this.config = Array.isArray(config)
      ? config
      : [{ ...config, isSingleConfig: true }];

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
    for (let i = 0; i < this.config.length; i++) {
      const config = await getAppSyncConfig(
        this.config[i],
        this.serverless.service.provider,
        this.serverless.config.servicePath,
      );

      const api = new Api(config, this);
      this.apis.push(api);
    }
  }

  async validateSchemas() {
    try {
      this.log.info('Validating schema');
      // todo validate
      this.log.success('GraphQL schema valid');
    } catch (error) {
      this.log.error('GraphQL schema invalid');
      throw error;
    }
  }

  addResources() {
    this.apis?.forEach((api) => {
      console.log(JSON.stringify(api.compile(), null, 2));
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
        resources: { Resources: this.getCloudWatchLogsRole(apiConfig) },
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

  getApiKeys(config: AppSyncConfig): ApiKeyConfigObject[] {
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

  getDefaultDataSourcePolicyStatements(
    ds: DataSourceConfig,
    config: AppSyncConfig,
  ) {
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

  getGraphQLSchemaResource(config: AppSyncConfig) {
    const logicalIdGraphQLApi = this.getLogicalId(config, RESOURCE_API);
    const logicalIdGraphQLSchema = this.getLogicalId(config, RESOURCE_SCHEMA);

    return {
      [logicalIdGraphQLSchema]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: config.schema,
          ApiId: config.apiId || {
            'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'],
          },
        },
      },
    };
  }

  getResolverResources(config: AppSyncConfig): CfnResolver {
    const flattenedMappingTemplates: ResolverConfig[] =
      config.mappingTemplates.reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        [] as ResolverConfig[],
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

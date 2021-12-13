import ServerlessAppsyncPlugin from 'index';
import path from 'path';
import fs from 'fs';
import { merge, set } from 'lodash';
import { has } from 'ramda';
import {
  CfnFunctionResolver,
  CfnResolver,
  CfnResource,
  CfnResources,
  FnJoin,
  IntrinsictFunction,
} from 'types/cloudFormation';
import {
  ApiKeyConfigObject,
  AppSyncConfig,
  Auth,
  CognitoAuth,
  DataSourceConfig,
  DsRelationalDbConfig,
  FunctionConfig,
  LambdaAuth,
  LambdaConfig,
  OidcAuth,
  Resolver,
} from 'types/plugin';
import { parseDuration } from 'utils';
import { DateTime } from 'luxon';
import { Naming } from './Naming';
import { DataSource } from './DataSource';

export class Api {
  public naming: Naming;

  constructor(
    private config: AppSyncConfig,
    private plugin: ServerlessAppsyncPlugin,
  ) {
    this.naming = new Naming(this.config.name, !!this.config.isSingleConfig);
  }

  compile() {
    // Waf
    // Output variables

    const resources: CfnResources = {};

    merge(resources, this.compileEndpoint());
    merge(resources, this.compileSchema());
    merge(resources, this.compileCloudWatchLogGroup());
    merge(resources, this.compileLambdaAuthorizerPermission());

    this.getApiKeys().forEach((key) => {
      merge(resources, this.compileApiKey(key));
    });

    this.config.dataSources.forEach((ds) => {
      merge(resources, this.compileDataSource(ds));
    });

    this.config.functionConfigurations.forEach((func) => {
      merge(resources, this.compilePipelineFunctionResource(func));
    });

    this.config.mappingTemplates.forEach((resolver) => {
      merge(resources, this.compileResolver(resolver));
    });

    return resources;
  }

  compileEndpoint(): CfnResources {
    const logicalId = this.naming.getApiLogicalId();

    const endpointResource: CfnResource = {
      Type: 'AWS::AppSync::GraphQLApi',
      Properties: {
        Name: this.config.name,
        XrayEnabled: this.config.xrayEnabled,
        Tags: this.getTagsConfig(),
      },
    };

    merge(
      endpointResource.Properties,
      this.compileAuthenticationProvider(this.config),
    );

    if (this.config.additionalAuthenticationProviders.length > 0) {
      merge(endpointResource.Properties, {
        AdditionalAuthenticationProviders:
          this.config.additionalAuthenticationProviders?.map((provider) =>
            this.compileAuthenticationProvider(provider),
          ),
      });
    }

    if (this.config.logConfig) {
      const logicalIdCloudWatchLogsRole =
        this.naming.getLogGroupRoleLogicalId();
      set(endpointResource, 'Properties.LogConfig', {
        CloudWatchLogsRoleArn: this.config.logConfig.loggingRoleArn || {
          'Fn::GetAtt': [logicalIdCloudWatchLogsRole, 'Arn'],
        },
        FieldLogLevel: this.config.logConfig.level,
        ExcludeVerboseContent: this.config.logConfig.excludeVerboseContent,
      });
    }

    const resources = {
      [logicalId]: endpointResource,
    };

    return resources;
  }

  compileCloudWatchLogGroup(): CfnResources {
    if (!this.config.logConfig) {
      return {};
    }

    const logGroupLogicalId = this.naming.getLogGroupLogicalId();
    const roleLogicalId = this.naming.getLogGroupRoleLogicalId();
    const apiLogicalId = this.naming.getApiLogicalId();

    return {
      [logGroupLogicalId]: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
          LogGroupName: {
            'Fn::Join': [
              '/',
              ['/aws/appsync/apis', { 'Fn::GetAtt': [apiLogicalId, 'ApiId'] }],
            ],
          },
          RetentionInDays:
            this.config.logConfig.logRetentionInDays ||
            this.plugin.serverless.service.provider.logRetentionInDays,
        },
      },
      [roleLogicalId]: {
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
              PolicyName: `${this.config.name} LogGroup Policy`,
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
                        'Fn::GetAtt': [logGroupLogicalId, 'Arn'],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    };
  }

  compileSchema() {
    const logicalId = this.naming.getSchemaLogicalId();

    return {
      [logicalId]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: this.config.schema,
          ApiId: this.getApiId(),
        },
      },
    };
  }

  compileLambdaAuthorizerPermission(): CfnResources {
    const lambdaAuth = [
      ...this.config.additionalAuthenticationProviders,
      this.config,
    ].find(({ authenticationType }) => authenticationType === 'AWS_LAMBDA') as
      | LambdaAuth
      | undefined;

    if (!lambdaAuth) {
      return {};
    }

    const logicalId = this.naming.getLambdaAuthLogicalId();
    const apiLogicalId = this.naming.getApiLogicalId();

    return {
      [logicalId]: {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          Action: 'lambda:InvokeFunction',
          FunctionName: this.getLambdaArn(lambdaAuth.lambdaAuthorizerConfig),
          Principal: 'appsync.amazonaws.com',
          SourceArn: { Ref: apiLogicalId },
        },
      },
    };
  }

  // FIXME: probably shoud be done before injecting the config. ie: config should be normalized
  getApiKeys(): ApiKeyConfigObject[] {
    if (!this.config.apiKeys) {
      return [
        {
          name: 'Default',
          description: 'Auto-generated api key',
        },
      ];
    }

    // FIXME: validate this before injecting config in class
    if (!Array.isArray(this.config.apiKeys)) {
      throw Error('apiKeys must be an array.');
    }

    return this.config.apiKeys.map((key) => {
      if (typeof key === 'string') {
        return { name: key };
      }

      return key;
    });
  }

  compileApiKey(config: ApiKeyConfigObject) {
    const { name, expiresAt, expiresAfter, description, apiKeyId } = config;

    const startOfHour = DateTime.now().setZone('UTC').startOf('hour');
    let expires: DateTime;
    if (expiresAfter) {
      expires = startOfHour.plus(parseDuration(expiresAfter));
    } else if (expiresAt) {
      expires = DateTime.fromISO(expiresAt);
    } else {
      // 1 year by default
      expires = startOfHour.plus({ days: 365 });
    }

    if (
      expires < DateTime.now().plus({ day: 1 }) ||
      expires > DateTime.now().plus({ years: 365 })
    ) {
      throw new Error(
        `Api Key ${name} must be valid for a minimum of 1 day and a maximum of 365 days.`,
      );
    }

    const logicalIdApiKey = this.naming.getApiKeyLogicalId(name);

    return {
      [logicalIdApiKey]: {
        Type: 'AWS::AppSync::ApiKey',
        Properties: {
          ApiId: this.getApiId(),
          Description: description || name,
          Expires: Math.round(expires.toMillis() / 1000),
          ApiKeyId: apiKeyId,
        },
      },
    };
  }

  compileCachingResources(): CfnResources {
    if (this.config.caching) {
      const cacheConfig = this.config.caching;
      const logicalId = this.naming.getCachingLogicalId();

      return {
        [logicalId]: {
          Type: 'AWS::AppSync::ApiCache',
          Properties: {
            ApiCachingBehavior: cacheConfig.behavior,
            ApiId: this.getApiId(),
            AtRestEncryptionEnabled: cacheConfig.atRestEncryption || false,
            TransitEncryptionEnabled: cacheConfig.transitEncryption || false,
            Ttl: cacheConfig.ttl || 3600,
            Type: cacheConfig.type || 'T2_SMALL',
          },
        },
      };
    }

    return {};
  }

  compileDataSource(dsConfig: DataSourceConfig): CfnResources {
    const dataSource = new DataSource(this, dsConfig);
    return dataSource.compile();
  }

  compileResolver(resolver: Resolver): CfnResources {
    let Properties: CfnResolver['Properties'] = {
      ApiId: this.getApiId(),
      TypeName: resolver.type,
      FieldName: resolver.field,
    };

    const requestTemplate = has('request')(resolver)
      ? resolver.request
      : this.config.defaultMappingTemplates?.request;
    if (requestTemplate !== false) {
      const reqTemplPath = path.join(
        this.config.mappingTemplatesLocation,
        requestTemplate || `${resolver.type}.${resolver.field}.request.vtl`,
      );
      const requestTemplateContent = fs.readFileSync(reqTemplPath, 'utf8');
      Properties.RequestMappingTemplate = this.processTemplateSubstitutions(
        requestTemplateContent,
        resolver.substitutions,
      );
    }

    const responseTemplate = has('response')(resolver)
      ? resolver.response
      : this.config.defaultMappingTemplates?.response;
    if (responseTemplate !== false) {
      const respTemplPath = path.join(
        this.config.mappingTemplatesLocation,
        responseTemplate || `${resolver.type}.${resolver.field}.response.vtl`,
      );
      const responseTemplateContent = fs.readFileSync(respTemplPath, 'utf8');
      Properties.ResponseMappingTemplate = this.processTemplateSubstitutions(
        responseTemplateContent,
        resolver.substitutions,
      );
    }

    if (this.config.caching) {
      if (resolver.caching === true) {
        // Use defaults
        Properties.CachingConfig = {
          Ttl: this.config.caching.ttl || 3600,
        };
      } else if (typeof resolver.caching === 'object') {
        Properties.CachingConfig = {
          CachingKeys: resolver.caching.keys,
          Ttl: resolver.caching.ttl || this.config.caching.ttl || 3600,
        };
      }
    }

    if (resolver.sync === true) {
      // Use defaults
      Properties.SyncConfig = {
        ConflictDetection: 'VERSION',
      };
    } else if (typeof resolver.sync === 'object') {
      Properties.SyncConfig = {
        ConflictDetection: resolver.sync.conflictDetection,
        ConflictHandler: resolver.sync.conflictHandler,
        ...(resolver.sync.conflictHandler === 'LAMBDA'
          ? {
              LambdaConflictHandlerConfig: {
                LambdaConflictHandlerArn: this.getLambdaArn(resolver.sync),
              },
            }
          : {}),
      };
    }

    if (resolver.kind === 'PIPELINE') {
      Properties = {
        ...Properties,
        Kind: 'PIPELINE',
        PipelineConfig: {
          Functions: resolver.functions.map((functionAttributeName) => {
            const logicalIdDataSource =
              this.naming.getPipelineFunctionLogicalId(functionAttributeName);
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
            this.naming.getDataSourceLogicalId(resolver.dataSource),
            'Name',
          ],
        },
      };
    }

    const logicalIdResolver = this.naming.getResolverLogicalId(
      resolver.type,
      resolver.field,
    );
    const logicalIdGraphQLSchema = this.naming.getSchemaLogicalId();

    return {
      [logicalIdResolver]: {
        Type: 'AWS::AppSync::Resolver',
        DependsOn: [logicalIdGraphQLSchema],
        Properties,
      },
    };
  }

  compilePipelineFunctionResource(config: FunctionConfig): CfnResources {
    const functionConfigLocation = this.config.functionConfigurationsLocation;

    const logicalId = this.naming.getPipelineFunctionLogicalId(config.name);
    const logicalIdDataSource = this.naming.getDataSourceLogicalId(
      config.dataSource,
    );

    const Properties: CfnFunctionResolver['Properties'] = {
      ApiId: this.getApiId(),
      Name: config.name,
      DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
      Description: config.description,
      FunctionVersion: '2018-05-29',
    };

    const requestTemplate = has('request')(config)
      ? config.request
      : this.config.defaultMappingTemplates?.request;
    if (requestTemplate !== false) {
      const reqTemplPath = path.join(
        functionConfigLocation,
        requestTemplate || `${config.name}.request.vtl`,
      );
      const requestTemplateContent = fs.readFileSync(reqTemplPath, 'utf8');
      Properties.RequestMappingTemplate = this.processTemplateSubstitutions(
        requestTemplateContent,
        config.substitutions,
      );
    }

    const responseTemplate = has('response')(config)
      ? config.response
      : this.config.defaultMappingTemplates?.response;
    if (responseTemplate !== false) {
      const respTemplPath = path.join(
        functionConfigLocation,
        responseTemplate || `${config.name}.response.vtl`,
      );
      const responseTemplateContent = fs.readFileSync(respTemplPath, 'utf8');
      Properties.ResponseMappingTemplate = this.processTemplateSubstitutions(
        responseTemplateContent,
        config.substitutions,
      );
    }

    return {
      [logicalId]: {
        Type: 'AWS::AppSync::FunctionConfiguration',
        Properties,
      },
    };
  }

  getApiId() {
    const logicalIdGraphQLApi = this.naming.getApiLogicalId();
    return (
      this.config.apiId || {
        'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'],
      }
    );
  }

  getUserPoolConfig(config: CognitoAuth) {
    const userPoolConfig = {
      AwsRegion: config.userPoolConfig.awsRegion || this.config.region,
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

  getTagsConfig() {
    if (!this.config.tags) {
      return [];
    }

    const tags = this.config.tags;
    return Object.keys(this.config.tags).map((key) => ({
      Key: key,
      Value: tags[key],
    }));
  }

  compileAuthenticationProvider(provider: Auth) {
    const { authenticationType } = provider;
    const authPrivider = {
      AuthenticationType: authenticationType,
    };

    if (authenticationType === 'AMAZON_COGNITO_USER_POOLS') {
      merge(authPrivider, { UserPoolConfig: this.getUserPoolConfig(provider) });
    } else if (authenticationType === 'OPENID_CONNECT') {
      merge(authPrivider, {
        OpenIDConnectConfig: this.getOpenIDConnectConfig(provider),
      });
    } else if (authenticationType === 'AWS_LAMBDA') {
      merge(authPrivider, {
        LambdaAuthorizerConfig: this.getLambdaAuthorizerConfig(provider),
      });
    }

    return authPrivider;
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
    const lambdaLogicalId = this.plugin.serverless
      .getProvider('aws')
      .naming.getLambdaLogicalId(functionName);
    const lambdaArn = { 'Fn::GetAtt': [lambdaLogicalId, 'Arn'] };

    return functionAlias
      ? { 'Fn::Join': [':', [lambdaArn, functionAlias]] }
      : lambdaArn;
  }

  processTemplateSubstitutions(
    template: string,
    substitutions?: Record<string, string | IntrinsictFunction>,
  ): string | IntrinsictFunction {
    // TODO use serverless variable parser and serverless variable syntax config
    const variableSyntax = RegExp(/\${([\w\d-_]+)}/g);
    const allSubstitutions = { ...this.config.substitutions, ...substitutions };
    const configVariables = Object.keys(allSubstitutions);
    const templateVariables: string[] = [];
    let searchResult;
    // eslint-disable-next-line no-cond-assign
    while ((searchResult = variableSyntax.exec(template)) !== null) {
      templateVariables.push(searchResult[1]);
    }

    const replacements = configVariables
      .filter((value) => templateVariables.indexOf(value) > -1)
      .filter((value, index, array) => array.indexOf(value) === index)
      .reduce(
        (accum, value) =>
          Object.assign(accum, { [value]: allSubstitutions[value] }),
        {},
      );

    // if there are substitutions for this template then add fn:sub
    if (Object.keys(replacements).length > 0) {
      return this.substituteGlobalTemplateVariables(template, replacements);
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

import ServerlessAppsyncPlugin from '..';
import { merge, set } from 'lodash';
import { has } from 'ramda';
import {
  CfnResource,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation';
import {
  ApiKeyConfigObject,
  AppSyncConfig,
  Auth,
  CognitoAuth,
  DataSourceConfig,
  FunctionConfig,
  LambdaAuth,
  LambdaConfig,
  OidcAuth,
  ResolverConfig,
} from '../types/plugin';
import { parseDuration } from '../utils';
import { DateTime } from 'luxon';
import { Naming } from './Naming';
import { DataSource } from './DataSource';
import { Resolver } from './Resolver';
import { PipelineFunction } from './PipelineFunction';

export class Api {
  public naming: Naming;

  constructor(
    public config: AppSyncConfig,
    private plugin: ServerlessAppsyncPlugin,
  ) {
    this.naming = new Naming(this.config.name, !!this.config.isSingleConfig);
  }

  compile() {
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
      this.compileAuthenticationProvider(this.config.authentication),
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
    const policyLogicalId = this.naming.getLogGroupRoleLogicalId();
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
      [policyLogicalId]: {
        Type: 'AWS::IAM::Policy',
        Properties: {
          PolicyName: `${policyLogicalId}`,
          Roles: [{ Ref: roleLogicalId }],
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
      this.config.authentication,
    ].find(({ type }) => type === 'AWS_LAMBDA') as LambdaAuth | undefined;

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
          FunctionName: this.getLambdaArn(lambdaAuth.config),
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

  compileResolver(resolverConfig: ResolverConfig): CfnResources {
    const resolver = new Resolver(this, resolverConfig);
    return resolver.compile();
  }

  compilePipelineFunctionResource(config: FunctionConfig): CfnResources {
    const func = new PipelineFunction(this, config);
    return func.compile();
  }

  getApiId() {
    const logicalIdGraphQLApi = this.naming.getApiLogicalId();
    return (
      this.config.apiId || {
        'Fn::GetAtt': [logicalIdGraphQLApi, 'ApiId'],
      }
    );
  }

  getUserPoolConfig(auth: CognitoAuth) {
    const userPoolConfig = {
      AwsRegion: auth.config.awsRegion || this.config.region,
      UserPoolId: auth.config.userPoolId,
      AppIdClientRegex: auth.config.appIdClientRegex,
      // Default action is the one passed in the config
      // or 'ALLOW' if the primary auth is Cognito User Pool
      // else, DENY
      DefaultAction:
        auth.config.defaultAction ||
        (this.config.authentication.type === 'AMAZON_COGNITO_USER_POOLS' &&
        this.config.additionalAuthenticationProviders.length > 0
          ? 'ALLOW'
          : 'DENY'),
    };

    return userPoolConfig;
  }

  getOpenIDConnectConfig(auth: OidcAuth) {
    if (!auth.config) {
      return;
    }

    const openIdConnectConfig = {
      Issuer: auth.config.issuer,
      ClientId: auth.config.clientId,
      IatTTL: auth.config.iatTTL,
      AuthTTL: auth.config.authTTL,
    };

    return openIdConnectConfig;
  }

  getLambdaAuthorizerConfig(auth: LambdaAuth) {
    if (!auth.config) {
      return;
    }

    const lambdaAuthorizerConfig = {
      AuthorizerUri: this.getLambdaArn(auth.config),
      IdentityValidationExpression: auth.config.identityValidationExpression,
      AuthorizerResultTtlInSeconds: auth.config.authorizerResultTtlInSeconds,
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
    const { type } = provider;
    const authPrivider = {
      AuthenticationType: type,
    };

    if (type === 'AMAZON_COGNITO_USER_POOLS') {
      merge(authPrivider, { UserPoolConfig: this.getUserPoolConfig(provider) });
    } else if (type === 'OPENID_CONNECT') {
      merge(authPrivider, {
        OpenIDConnectConfig: this.getOpenIDConnectConfig(provider),
      });
    } else if (type === 'AWS_LAMBDA') {
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
  ): IntrinsicFunction {
    const lambdaLogicalId = this.plugin.serverless
      .getProvider('aws')
      .naming.getLambdaLogicalId(functionName);
    const lambdaArn = { 'Fn::GetAtt': [lambdaLogicalId, 'Arn'] };

    return functionAlias
      ? { 'Fn::Join': [':', [lambdaArn, functionAlias]] }
      : lambdaArn;
  }
}

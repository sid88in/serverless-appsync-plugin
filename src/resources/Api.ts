import ServerlessAppsyncPlugin from '..';
import { merge, set } from 'lodash';
import {
  CfnResource,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation';
import {
  ApiKeyConfig,
  AppSyncConfig,
  Auth,
  CognitoAuth,
  DataSourceConfig,
  PipelineFunctionConfig,
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
import { Schema } from './Schema';
import { Waf } from './Waf';

export class Api {
  public naming: Naming;
  public functions: Record<string, Record<string, unknown>> = {};

  constructor(
    public config: AppSyncConfig,
    public plugin: ServerlessAppsyncPlugin,
  ) {
    this.naming = new Naming(this.config.name, !!this.config.isSingleConfig);
  }

  compile() {
    const resources: CfnResources = {};

    merge(resources, this.compileEndpoint());
    merge(resources, this.compileSchema());
    merge(resources, this.compileCloudWatchLogGroup());
    merge(resources, this.compileLambdaAuthorizerPermission());
    merge(resources, this.compileWafRules());

    this.config.apiKeys?.forEach((key) => {
      merge(resources, this.compileApiKey(key));
    });

    this.config.dataSources.forEach((ds) => {
      merge(resources, this.compileDataSource(ds));
    });

    this.config.pipelineFunctions.forEach((func) => {
      merge(resources, this.compilePipelineFunctionResource(func));
    });

    this.config.resolvers.forEach((resolver) => {
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
        XrayEnabled: this.config.xrayEnabled || false,
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

    if (this.config.log) {
      const logicalIdCloudWatchLogsRole =
        this.naming.getLogGroupRoleLogicalId();
      set(endpointResource, 'Properties.LogConfig', {
        CloudWatchLogsRoleArn: this.config.log.roleArn || {
          'Fn::GetAtt': [logicalIdCloudWatchLogsRole, 'Arn'],
        },
        FieldLogLevel: this.config.log.level,
        ExcludeVerboseContent: this.config.log.excludeVerboseContent,
      });
    }

    const resources = {
      [logicalId]: endpointResource,
    };

    return resources;
  }

  compileCloudWatchLogGroup(): CfnResources {
    if (!this.config.log) {
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
            this.config.log.logRetentionInDays ||
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
    const schema = new Schema(this, this.config.schema);
    return schema.compile();
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
          FunctionName: this.getLambdaArn(
            lambdaAuth.config,
            this.naming.getAuthenticationEmbeddedLamdbaName(),
          ),
          Principal: 'appsync.amazonaws.com',
          SourceArn: { Ref: apiLogicalId },
        },
      },
    };
  }

  compileApiKey(config: ApiKeyConfig) {
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

  compilePipelineFunctionResource(
    config: PipelineFunctionConfig,
  ): CfnResources {
    const func = new PipelineFunction(this, config);
    return func.compile();
  }

  compileWafRules() {
    if (!this.config.waf || this.config.waf.enabled === false) {
      return {};
    }

    const waf = new Waf(this, this.config.waf);
    return waf.compile();
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
      AwsRegion: auth.config.awsRegion || { 'Fn::Sub': '${AWS::Region}' },
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
      AuthorizerUri: this.getLambdaArn(
        auth.config,
        this.naming.getAuthenticationEmbeddedLamdbaName(),
      ),
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

  getLambdaArn(config: LambdaConfig, embededFunctionName: string) {
    if ('functionArn' in config) {
      return config.functionArn;
    } else if ('functionName' in config) {
      return this.generateLambdaArn(config.functionName, config.functionAlias);
    } else if ('function' in config) {
      this.functions[embededFunctionName] = config.function;
      return this.generateLambdaArn(embededFunctionName);
    }

    throw new Error(
      'You must specify either `functionArn`, `functionName` or `function` for lambda definitions.',
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

  hasDataSource(name: string) {
    return this.config.dataSources.some((ds) => ds.name === name);
  }

  hasPipelineFunction(name: string) {
    return this.config.pipelineFunctions.some((ds) => ds.name === name);
  }
}

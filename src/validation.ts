import Ajv, { JSONSchemaType } from 'ajv';
import ajvErrors from 'ajv-errors';
import { AppSyncConfigInput } from './get-config';
import { IntrinsicFunction } from './types/cloudFormation';
import {
  CognitoAuth,
  DataSourceConfig,
  DsDynamoDBConfig,
  DsElasticSearchConfig,
  DsHttpConfig,
  DsLambdaConfig,
  DsNone,
  DsRelationalDbConfig,
  FunctionConfig,
  IamStatement,
  LambdaAuth,
  LambdaConfig,
  OidcAuth,
  ResolverConfig,
  Substitutions,
  VisibilityConfig,
  WafRule,
  WafRuleCustom,
} from './types/plugin';

export const appSyncSchema: JSONSchemaType<AppSyncConfigInput> & {
  definitions: {
    stringOrIntrinsicFunction: JSONSchemaType<string | IntrinsicFunction>;
    lambdaFunctionConfig: JSONSchemaType<LambdaConfig>;
    cognitoAuth: JSONSchemaType<CognitoAuth['config']>;
    lambdaAuth: JSONSchemaType<LambdaAuth['config']>;
    oidcAuth: JSONSchemaType<OidcAuth['config']>;
    visibilityConfig: JSONSchemaType<VisibilityConfig>;
    wafRule: JSONSchemaType<WafRule>;
    customWafRule: JSONSchemaType<
      Omit<WafRuleCustom, 'statement'> & { statement: Record<string, unknown> }
    >;
    mappingTemplate: JSONSchemaType<string | false>;
    substitutions: JSONSchemaType<Substitutions>;
    resolverConfig: JSONSchemaType<ResolverConfig>;
    pipelineFunctionConfig: JSONSchemaType<FunctionConfig>;
    resolverCachingConfig: JSONSchemaType<ResolverConfig['caching']>;
    resolverSyncConfig: JSONSchemaType<ResolverConfig['sync']>;
    iamRoleStatements: JSONSchemaType<IamStatement[]>;
    dataSourceConfig: JSONSchemaType<DataSourceConfig>;
    dataSourceHttp: JSONSchemaType<DsHttpConfig>;
    dataSourceDynamoDb: JSONSchemaType<DsDynamoDBConfig>;
    datasourceRelationalDbConfig: JSONSchemaType<DsRelationalDbConfig>;
    datasourceLambdaConfig: JSONSchemaType<DsLambdaConfig>;
    datasourceEsConfig: JSONSchemaType<DsElasticSearchConfig>;
    datasourceNoneConfig: JSONSchemaType<DsNone>;
  };
} = {
  type: 'object',
  definitions: {
    stringOrIntrinsicFunction: {
      oneOf: [
        { type: 'string' },
        {
          type: 'object',
          required: [],
          additionalProperties: true,
        },
      ],
      errorMessage: 'is not a string or a CloudFormation intrinsic function',
    },
    lambdaFunctionConfig: {
      oneOf: [
        {
          type: 'object',
          properties: {
            functionName: { type: 'string' },
            functionAlias: { type: 'string', nullable: true },
          },
          required: ['functionName'],
        },
        {
          type: 'object',
          properties: {
            functionArn: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
          },
          required: ['functionArn'],
        },
      ],
      errorMessage:
        'must have a valid functionName or functionArn, but not both',
    },
    auth: {
      type: 'object',
      title: 'Authentication',
      description: 'Authentication type and definition',
      properties: {
        type: {
          type: 'string',
          enum: [
            'AMAZON_COGNITO_USER_POOLS',
            'AWS_LAMBDA',
            'OPENID_CONNECT',
            'AWS_IAM',
            'API_KEY',
          ],
        },
      },
      if: { properties: { type: { const: 'AMAZON_COGNITO_USER_POOLS' } } },
      then: {
        properties: { config: { $ref: '#/definitions/cognitoAuth' } },
        required: ['config'],
      },
      else: {
        if: { properties: { type: { const: 'AWS_LAMBDA' } } },
        then: {
          properties: { config: { $ref: '#/definitions/lambdaAuth' } },
          required: ['config'],
        },
        else: {
          if: { properties: { type: { const: 'OPENID_CONNECT' } } },
          then: {
            properties: { config: { $ref: '#/definitions/oidcAuth' } },
            required: ['config'],
          },
        },
      },
      required: ['type'],
      // errorMessage: 'is not a valid ${0/type} authentication definition',
    },
    cognitoAuth: {
      type: 'object',
      properties: {
        userPoolId: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        awsRegion: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        defaultAction: {
          type: 'string',
          enum: ['ALLOW', 'DENY'],
          nullable: true,
          errorMessage: 'must be "ALLOW" or "DENY"',
        },
        appIdClientRegex: { type: 'string', nullable: true },
      },
      required: ['userPoolId'],
    },
    lambdaAuth: {
      type: 'object',
      oneOf: [{ $ref: '#/definitions/lambdaFunctionConfig' }],
      properties: {
        // Note: functionName and functionArn are already defined in #/definitions/lambdaFunctionConfig
        // But if not also defined here, TypeScript shows an error.
        functionName: { type: 'string' },
        functionArn: { type: 'string' },
        identityValidationExpression: { type: 'string', nullable: true },
        authorizerResultTtlInSeconds: { type: 'number', nullable: true },
      },
      required: [],
    },
    oidcAuth: {
      type: 'object',
      properties: {
        issuer: { type: 'string' },
        clientId: { type: 'string' },
        iatTTL: { type: 'number', nullable: true },
        authTTL: { type: 'number', nullable: true },
      },
      required: ['issuer', 'clientId'],
    },
    iamAuth: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          const: 'AWS_IAM',
        },
      },
      required: ['type'],
      errorMessage: 'is not a valid IAM config',
    },
    apiKeyAuth: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          const: 'API_KEY',
        },
        // TODO: move apiKeys here?
      },
      required: ['type'],
      errorMessage: 'is not a valid API_KEY config',
    },
    visibilityConfig: {
      type: 'object',
      properties: {
        cloudWatchMetricsEnabled: { type: 'boolean', nullable: true },
        name: { type: 'string', nullable: true },
        sampledRequestsEnabled: { type: 'boolean', nullable: true },
      },
      required: [],
    },
    wafRule: {
      oneOf: [
        { type: 'string', enum: ['throttle', 'disableIntrospection'] },
        {
          type: 'object',
          properties: {
            disableIntrospection: {
              type: 'object',
              properties: {
                name: { type: 'string', nullable: true },
                priority: { type: 'integer', nullable: true },
              },
            },
          },
          required: [],
        },
        {
          type: 'object',
          properties: {
            throttle: {
              oneOf: [
                { type: 'integer' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string', nullable: true },
                    action: {
                      type: 'string',
                      enum: ['Allow', 'Block'],
                      nullable: true,
                    },
                    aggregateKeyType: {
                      type: 'string',
                      enum: ['IP', 'FORWARDED_IP'],
                      nullable: true,
                    },
                    limit: { type: 'integer', nullable: true },
                    priority: { type: 'integer', nullable: true },
                    scopeDownStatement: { type: 'object', nullable: true },
                    forwardedIPConfig: {
                      type: 'object',
                      properties: {
                        headerName: { type: 'string' },
                        fallbackBehavior: { type: 'string' },
                      },
                      required: ['headerName', 'fallbackBehavior'],
                      nullable: true,
                    },
                  },
                  required: [],
                },
              ],
            },
          },
          required: [],
        },
      ],
      errorMessage: 'is not a valid WAF rule',
    },
    customWafRule: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        priority: { type: 'number', nullable: true },
        action: {
          type: 'string',
          enum: ['Allow', 'Block'],
          nullable: true,
        },
        statement: { type: 'object', required: [] },
        visibilityConfig: { $ref: '#/definitions/visibilityConfig' },
      },
      required: ['name', 'statement'],
    },
    mappingTemplate: {
      oneOf: [{ type: 'string' }, { type: 'boolean', const: false }],
      errorMessage: 'is not a valid mapping template',
    },
    // @ts-ignore
    substitutions: {
      type: 'object',
      additionalProperties: { $ref: '#/definitions/stringOrIntrinsicFunction' },
      required: [],
      errorMessage: 'is not a valid substitutions definition',
    },
    resolverConfig: {
      type: 'object',
      oneOf: [
        {
          type: 'object',
          properties: {
            kind: { type: 'string', const: 'UNIT' },
            dataSource: { type: 'string' },
          },
          required: ['kind', 'dataSource'],
        },
        {
          type: 'object',
          properties: {
            kind: { type: 'string', const: 'PIPELINE' },
            functions: { type: 'array', items: { type: 'string' } },
          },
          required: ['kind', 'functions'],
        },
      ],
      properties: {
        type: { type: 'string' },
        kind: { type: 'string' },
        dataSource: { type: 'string' },
        functions: { type: 'array', items: { type: 'string' } },
        field: { type: 'string' },
        request: { $ref: '#/definitions/mappingTemplate' },
        response: { $ref: '#/definitions/mappingTemplate' },
        sync: { $ref: '#/definitions/resolverSyncConfig' },
        substitutions: { $ref: '#/definitions/substitutions' },
        caching: { $ref: '#/definitions/resolverCachingConfig' },
      },
      required: ['type', 'field'],
      errorMessage: 'is not a resolver config',
    },
    pipelineFunctionConfig: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        dataSource: { type: 'string' },
        description: { type: 'string', nullable: true },
        request: { $ref: '#/definitions/mappingTemplate' },
        response: { $ref: '#/definitions/mappingTemplate' },
        substitutions: { $ref: '#/definitions/substitutions' },
      },
      required: ['name', 'dataSource'],
      errorMessage: 'is not a valid pipeline function config',
    },
    resolverCachingConfig: {
      oneOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            ttl: { type: 'integer', nullable: true },
            keys: { type: 'array', items: { type: 'string' }, nullable: true },
          },
          required: [],
        },
      ],
      errorMessage: 'is not a valid resolver caching config',
    },
    resolverSyncConfig: {
      oneOf: [
        { type: 'boolean' },
        {
          type: 'object',
          oneOf: [{ $ref: '#/definitions/lambdaFunctionConfig' }],
          properties: {
            functionArn: { type: 'string' },
            functionName: { type: 'string' },
            conflictDetection: { type: 'string', const: 'VERSION' },
            conflictHandler: {
              type: 'string',
              enum: ['LAMBDA', 'OPTIMISTIC_CONCURRENCY'],
            },
          },
          required: [],
        },
      ],
      errorMessage: 'is not a valid resolver sync config',
    },
    // @ts-ignore
    iamRoleStatements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          Effect: { type: 'string', enum: ['Allow', 'Deny'] },
          Action: { type: 'array', items: { type: 'string' } },
          Resource: {
            oneOf: [
              { $ref: '#/definitions/stringOrIntrinsicFunction' },
              {
                type: 'array',
                items: { $ref: '#/definitions/stringOrIntrinsicFunction' },
              },
            ],
          },
        },
        required: ['Effect', 'Action', 'Resource'],
        errorMessage: 'is not a valid IAM role statement',
      },
    },
    dataSourceConfig: {
      type: 'object',
      oneOf: [
        { $ref: '#/definitions/dataSourceHttpConfig' },
        { $ref: '#/definitions/dataSourceDynamoDb' },
        { $ref: '#/definitions/datasourceRelationalDbConfig' },
        { $ref: '#/definitions/datasourceLambdaConfig' },
        { $ref: '#/definitions/datasourceEsConfig' },
        { $ref: '#/definitions/datasourceNoneConfig' },
      ],
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string', nullable: true },
      },
      required: ['name', 'type'],
      errorMessage: 'is not a valid data source config',
    },
    dataSourceHttpConfig: {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'HTTP' },
        config: {
          type: 'object',
          properties: {
            endpoint: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            serviceRoleArn: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
            iamRoleStatements: {
              $ref: '#/definitions/iamRoleStatements',
            },
            authorizationConfig: {
              type: 'object',
              properties: {
                authorizationType: { type: 'string', const: 'AWS_IAM' },
                awsIamConfig: {
                  type: 'object',
                  properties: {
                    signingRegion: {
                      $ref: '#/definitions/stringOrIntrinsicFunction',
                    },
                    signingServiceName: {
                      $ref: '#/definitions/stringOrIntrinsicFunction',
                    },
                  },
                  required: ['signingRegion'],
                },
              },
              required: ['authorizationType', 'awsIamConfig'],
              nullable: true,
            },
          },
          required: ['endpoint'],
        },
      },
      required: ['type', 'config'],
      errorMessage: 'is not a valid HTTP data source config',
    },
    dataSourceDynamoDb: {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'AMAZON_DYNAMODB' },
        config: {
          type: 'object',
          properties: {
            tableName: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            useCallerCredentials: { type: 'boolean', nullable: true },
            serviceRoleArn: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
            region: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
            iamRoleStatements: {
              $ref: '#/definitions/iamRoleStatements',
            },
            versioned: { type: 'boolean', nullable: true },
            deltaSyncConfig: {
              type: 'object',
              properties: {
                deltaSyncTableName: { type: 'string' },
                baseTableTTL: { type: 'integer', nullable: true },
                deltaSyncTableTTL: { type: 'integer', nullable: true },
              },
              required: ['deltaSyncTableName'],
              nullable: true,
            },
          },
          required: ['tableName'],
        },
      },
      required: ['type', 'config'],
      errorMessage: 'is not a valid AMAZON_DYNAMODB data source config',
    },
    datasourceRelationalDbConfig: {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'RELATIONAL_DATABASE' },
        config: {
          type: 'object',
          properties: {
            region: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            relationalDatabaseSourceType: {
              type: 'string',
              enum: ['RDS_HTTP_ENDPOINT'],
              nullable: true,
            },
            serviceRoleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            dbClusterIdentifier: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
            databaseName: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            schema: { type: 'string', nullable: true },
            awsSecretStoreArn: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
            iamRoleStatements: {
              $ref: '#/definitions/iamRoleStatements',
            },
          },
          required: ['awsSecretStoreArn', 'dbClusterIdentifier'],
        },
      },
      required: ['type', 'config'],
      errorMessage: 'is not a valid RELATIONAL_DATABASE data source config',
    },
    datasourceLambdaConfig: {
      type: 'object',
      oneOf: [
        {
          $ref: '#/definitions/lambdaFunctionConfig',
        },
      ],
      properties: {
        type: { type: 'string', const: 'AWS_LAMBDA' },
        config: {
          type: 'object',
          properties: {
            functionName: { type: 'string' },
            functionArn: {
              $ref: '#/definitions/stringOrIntrinsicFunction',
            },
            serviceRoleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            iamRoleStatements: { $ref: '#/definitions/iamRoleStatements' },
          },
          required: [],
        },
      },
      required: ['type', 'config'],
      errorMessage: 'is not a valid AWS_LAMBDA data source config',
    },
    datasourceEsConfig: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['AMAZON_ELASTICSEARCH', 'AMAZON_OPENSEARCH_SERVICE'],
        },
        config: {
          type: 'object',
          oneOf: [
            {
              type: 'object',
              properties: {
                endpoint: {
                  $ref: '#/definitions/stringOrIntrinsicFunction',
                },
              },
              required: ['endpoint'],
            },
            {
              type: 'object',
              properties: {
                domain: {
                  $ref: '#/definitions/stringOrIntrinsicFunction',
                },
              },
            },
          ],
          properties: {
            endpoint: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            domain: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            region: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            serviceRoleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
            iamRoleStatements: { $ref: '#/definitions/iamRoleStatements' },
          },
          required: [],
        },
      },
      required: ['type', 'config'],
      errorMessage: 'is not a valid AMAZON_ELASTICSEARCH data source config',
    },
    datasourceNoneConfig: {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'NONE' },
      },
      required: ['type'],
      errorMessage: 'is not a valid NONE data source config',
    },
  },
  properties: {
    apiId: { type: 'string' },
    name: { type: 'string' },
    authentication: { $ref: '#/definitions/auth' },
    schema: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'array',
          items: { type: 'string' },
        },
      ],
      errorMessage: 'is not a valid schema config',
    },
    xrayEnabled: { type: 'boolean' },
    substitutions: { $ref: '#/definitions/substitutions' },
    wafConfig: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        name: { type: 'string' },
        defaultAction: { type: 'string', enum: ['Allow', 'Block'] },
        description: { type: 'string' },
        rules: {
          type: 'array',
          items: { $ref: '#/definitions/wafRule' },
        },
      },
      required: ['name', 'defaultAction', 'rules'],
      errorMessage: 'is not a valid WAF config',
    },
    tags: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    caching: {
      type: 'object',
      properties: {
        behavior: {
          type: 'string',
          enum: ['FULL_REQUEST_CACHING' || 'PER_RESOLVER_CACHING'],
        },
        type: {
          enum: [
            'SMALL',
            'MEDIUM',
            'LARGE',
            'XLARGE',
            'LARGE_2X',
            'LARGE_4X',
            'LARGE_8X',
            'LARGE_12X',
          ],
        },
        ttl: { type: 'number' },
        atRestEncryption: { type: 'boolean' },
        transitEncryption: { type: 'boolean' },
      },
      required: ['behavior'],
      errorMessage: 'is not a valid caching config',
    },
    additionalAuthenticationProviders: {
      type: 'array',
      items: { $ref: '#/definitions/auth' },
    },
    apiKeys: {
      type: 'array',
      items: {
        type: 'object',
        oneOf: [
          {
            type: 'object',
            properties: { expiresAfter: { type: 'string' } },
            required: ['expiresAfter'],
          },
          {
            type: 'object',
            properties: { expiresAt: { type: 'string' } },
            required: ['expiresAt'],
          },
        ],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          wafRules: {
            type: 'array',
            items: { $ref: '#/definitions/wafRule' },
          },
        },
        required: ['name'],
        errorMessage: 'is not a valid API key config',
      },
    },
    logConfig: {
      type: 'object',
      properties: {
        loggingRoleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        level: {
          type: 'string',
          enum: ['ALL', 'ERROR', 'NONE'],
        },
        logRetentionInDays: { type: 'integer' },
        excludeVerboseContent: { type: 'boolean' },
      },
      errorMessage: 'is not a valid Cloudwatch log config',
    },
    mappingTemplatesLocation: {
      type: 'object',
      properties: {
        resolvers: { type: 'string' },
        pipelineFunctions: { type: 'string' },
      },
    },
    defaultMappingTemplates: {
      type: 'object',
      properties: {
        request: {
          oneOf: [{ type: 'string' }, { type: 'boolean' }],
        },
        response: {
          oneOf: [{ type: 'string' }, { type: 'boolean' }],
        },
      },
    },
    dataSources: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: '#/definitions/dataSourceConfig' },
          { type: 'array', items: { $ref: '#/definitions/dataSourceConfig' } },
        ],
      },
    },
    resolvers: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: '#/definitions/resolverConfig' },
          { type: 'array', items: { $ref: '#/definitions/resolverConfig' } },
        ],
      },
    },
    pipelineFunctions: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: '#/definitions/lambdaFunctionConfig' },
          {
            type: 'array',
            items: { $ref: '#/definitions/lambdaFunctionConfig' },
          },
        ],
      },
    },
  },
  required: ['name', 'authentication'],
};

const ajv = new Ajv({ allErrors: true });
ajvErrors(ajv);

const validator = ajv.compile(appSyncSchema);
export const validateConfig = (data: Record<string, unknown>) => {
  const isValid = validator(data);
  if (isValid === false && validator.errors) {
    console.log(validator.errors);
    throw new Error(
      validator.errors
        .filter((error) => !['if', 'oneOf'].includes(error.keyword))
        .map((error) => {
          return `${error.instancePath}: ${error.message}`;
        })
        .join('\n'),
    );
  }

  return isValid;
};

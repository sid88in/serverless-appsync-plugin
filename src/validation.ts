import Ajv, { JSONSchemaType } from 'ajv';
import ajvErrors from 'ajv-errors';
import { AppSyncConfigInput } from './get-config';
import { IntrinsicFunction } from './types/cloudFormation';
import {
  Auth,
  CognitoAuth,
  DataSourceConfig,
  DsDynamoDBConfig,
  DsElasticSearchConfig,
  DsHttpConfig,
  DsLambdaConfig,
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

const AUTH_TYPES = [
  'AMAZON_COGNITO_USER_POOLS',
  'AWS_LAMBDA',
  'OPENID_CONNECT',
  'AWS_IAM',
  'API_KEY',
] as const;

const DATASOURCE_TYPES = [
  'AMAZON_DYNAMODB',
  'AMAZON_ELASTICSEARCH',
  'AMAZON_OPENSEARCH_SERVICE',
  'AWS_LAMBDA',
  'HTTP',
  'NONE',
  'RELATIONAL_DATABASE',
] as const;

export const appSyncSchema: JSONSchemaType<AppSyncConfigInput> & {
  definitions: {
    stringOrIntrinsicFunction: JSONSchemaType<string | IntrinsicFunction>;
    lambdaFunctionConfig: JSONSchemaType<LambdaConfig>;
    auth: JSONSchemaType<Pick<Auth, 'type'>>;
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
    dataSourceConfig: JSONSchemaType<
      Pick<DataSourceConfig, 'name' | 'type' | 'description'>
    >;
    dataSourceHttp: JSONSchemaType<DsHttpConfig['config']>;
    dataSourceDynamoDb: JSONSchemaType<DsDynamoDBConfig['config']>;
    datasourceRelationalDbConfig: JSONSchemaType<
      DsRelationalDbConfig['config']
    >;
    datasourceLambdaConfig: JSONSchemaType<DsLambdaConfig['config']>;
    datasourceEsConfig: JSONSchemaType<DsElasticSearchConfig['config']>;
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
      errorMessage: 'must be a string or a CloudFormation intrinsic function',
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
      errorMessage: 'must have functionName or functionArn (but not both)',
    },
    auth: {
      type: 'object',
      title: 'Authentication',
      description: 'Authentication type and definition',
      properties: {
        type: {
          type: 'string',
          enum: AUTH_TYPES,
          errorMessage: `must be one of ${AUTH_TYPES.join(', ')}`,
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
      properties: {
        type: { type: 'string', nullable: true },
        kind: { type: 'string', nullable: true },
        dataSource: { type: 'string' },
        functions: { type: 'array', items: { type: 'string' } },
        field: { type: 'string' },
        request: { $ref: '#/definitions/mappingTemplate' },
        response: { $ref: '#/definitions/mappingTemplate' },
        sync: { $ref: '#/definitions/resolverSyncConfig' },
        substitutions: { $ref: '#/definitions/substitutions' },
        caching: { $ref: '#/definitions/resolverCachingConfig' },
      },

      if: { properties: { type: { const: 'PIPELINE' } } },
      then: {
        required: ['functions'],
      },
      else: {
        required: ['dataSource'],
      },
      required: ['type', 'field'],
      errorMessage: 'is not a resolver config',
    },
    pipelineFunctionConfig: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        dataSource: { type: 'string' },
        description: { type: 'string', nullable: true },
        request: { $ref: '#/definitions/mappingTemplate' },
        response: { $ref: '#/definitions/mappingTemplate' },
        substitutions: { $ref: '#/definitions/substitutions' },
      },
      required: ['dataSource'],
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
      properties: {
        name: { type: 'string', nullable: true },
        type: {
          type: 'string',
          enum: DATASOURCE_TYPES,
          errorMessage: `must be one of ${DATASOURCE_TYPES.join(', ')}`,
        },
        description: { type: 'string', nullable: true },
      },
      if: { properties: { type: { const: 'AMAZON_DYNAMODB' } } },
      then: {
        properties: { config: { $ref: '#/definitions/dataSourceDynamoDb' } },
        required: ['config'],
      },
      else: {
        if: { properties: { type: { const: 'AWS_LAMBDA' } } },
        then: {
          properties: {
            config: { $ref: '#/definitions/datasourceLambdaConfig' },
          },
          required: ['config'],
        },
        else: {
          if: { properties: { type: { const: 'HTTP' } } },
          then: {
            properties: {
              config: { $ref: '#/definitions/dataSourceHttpConfig' },
            },
            required: ['config'],
          },
          else: {
            if: {
              properties: {
                type: {
                  enum: ['AMAZON_ELASTICSEARCH', 'AMAZON_OPENSEARCH_SERVICE'],
                },
              },
            },
            then: {
              properties: {
                config: { $ref: '#/definitions/datasourceEsConfig' },
              },
              required: ['config'],
            },
            else: {
              if: { properties: { type: { const: 'RELATIONAL_DATABASE' } } },
              then: {
                properties: {
                  config: {
                    $ref: '#/definitions/datasourceRelationalDbConfig',
                  },
                },
                required: ['config'],
              },
            },
          },
        },
      },
      required: ['type'],
    },
    dataSourceHttpConfig: {
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
            authorizationType: {
              type: 'string',
              enum: ['AWS_IAM'],
              errorMessage: 'must be AWS_IAM',
            },
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
    dataSourceDynamoDb: {
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
    datasourceRelationalDbConfig: {
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
    datasourceLambdaConfig: {
      type: 'object',
      oneOf: [
        {
          $ref: '#/definitions/lambdaFunctionConfig',
        },
      ],
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
    datasourceEsConfig: {
      type: 'object',
      oneOf: [
        {
          oneOf: [
            {
              type: 'object',
              properties: {
                endpoint: { $ref: '#/definitions/stringOrIntrinsicFunction' },
              },
              required: ['endpoint'],
            },
            {
              type: 'object',
              properties: {
                domain: { $ref: '#/definitions/stringOrIntrinsicFunction' },
              },
              required: ['domain'],
            },
          ],
          errorMessage: 'must have a endpoint or domain (but not both)',
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
      oneOf: [
        {
          type: 'object',
          additionalProperties: { $ref: '#/definitions/dataSourceConfig' },
        },
        {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: { $ref: '#/definitions/dataSourceConfig' },
          },
        },
      ],
      errorMessage: 'contains invalid data source definitions',
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
    throw new Error(
      validator.errors
        .filter((error) => !['if', 'oneOf', 'anyOf'].includes(error.keyword))
        .map((error) => {
          return `${error.instancePath}: ${error.message}`;
        })
        .join('\n'),
    );
  }

  return isValid;
};

export const stringOrIntrinsicFunction = {
  oneOf: [
    { type: 'string' },
    {
      type: 'object',
      required: [],
      additionalProperties: true,
    },
  ],
  errorMessage: 'must be a string or a CloudFormation intrinsic function',
};
// Depends on stringOrIntrinsicFunction
export const substitutions = {
  type: 'object',
  additionalProperties: {
    $ref: '#/definitions/stringOrIntrinsicFunction',
  },
  required: [],
  errorMessage: 'must be a valid substitutions definition',
};

export const AUTH_TYPES = [
  'AMAZON_COGNITO_USER_POOLS',
  'AWS_LAMBDA',
  'OPENID_CONNECT',
  'AWS_IAM',
  'API_KEY',
] as const;

export const DATASOURCE_TYPES = [
  'AMAZON_DYNAMODB',
  'AMAZON_OPENSEARCH_SERVICE',
  'AWS_LAMBDA',
  'HTTP',
  'NONE',
  'RELATIONAL_DATABASE',
  'AMAZON_EVENTBRIDGE',
] as const;

// Depends on stringOrIntrinsicFunction
export const lambdaFunctionConfig = {
  oneOf: [
    {
      type: 'object',
      properties: {
        functionName: { type: 'string' },
        functionAlias: { type: 'string' },
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
    {
      type: 'object',
      properties: {
        function: { type: 'object' },
      },
      required: ['function'],
    },
  ],
  errorMessage:
    'must specify functionName, functionArn or function (all exclusives)',
};

//depends on cognitoAuth, lambdaAuth and oidcAuth
export const auth = {
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
};

// Depends on stringOrIntrinsicFunction
export const cognitoAuth = {
  type: 'object',
  properties: {
    userPoolId: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    awsRegion: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    defaultAction: {
      type: 'string',
      enum: ['ALLOW', 'DENY'],
      errorMessage: 'must be "ALLOW" or "DENY"',
    },
    appIdClientRegex: { $ref: '#/definitions/stringOrIntrinsicFunction' },
  },
  required: ['userPoolId'],
};

// Depends on lambdaFunctionConfig
export const lambdaAuth = {
  type: 'object',
  oneOf: [{ $ref: '#/definitions/lambdaFunctionConfig' }],
  properties: {
    // Note: functionName and functionArn are already defined in #/definitions/lambdaFunctionConfig
    // But if not also defined here, TypeScript shows an error.
    functionName: { type: 'string' },
    functionArn: { type: 'string' },
    identityValidationExpression: { type: 'string' },
    authorizerResultTtlInSeconds: { type: 'number' },
  },
  required: [],
};

export const oidcAuth = {
  type: 'object',
  properties: {
    issuer: { type: 'string' },
    clientId: { type: 'string' },
    iatTTL: { type: 'number' },
    authTTL: { type: 'number' },
  },
  required: ['issuer'],
};

export const iamAuth = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'AWS_IAM',
    },
  },
  required: ['type'],
  errorMessage: 'must be a valid IAM config',
};

export const apiKeyAuth = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'API_KEY',
    },
  },
  required: ['type'],
  errorMessage: 'must be a valid API_KEY config',
};

export const visibilityConfig = {
  type: 'object',
  properties: {
    cloudWatchMetricsEnabled: { type: 'boolean' },
    name: { type: 'string' },
    sampledRequestsEnabled: { type: 'boolean' },
  },
  required: [],
};

// Depends on visibilityConfig and customWafRule
export const wafRule = {
  anyOf: [
    { type: 'string', enum: ['throttle', 'disableIntrospection'] },
    {
      type: 'object',
      properties: {
        disableIntrospection: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            priority: { type: 'integer' },
            visibilityConfig: { $ref: '#/definitions/visibilityConfig' },
          },
        },
      },
      required: ['disableIntrospection'],
    },
    {
      type: 'object',
      properties: {
        throttle: {
          oneOf: [
            { type: 'integer', minimum: 100 },
            {
              type: 'object',
              properties: {
                name: { type: 'string' },
                action: {
                  type: 'string',
                  enum: ['Allow', 'Block'],
                },
                aggregateKeyType: {
                  type: 'string',
                  enum: ['IP', 'FORWARDED_IP'],
                },
                limit: { type: 'integer', minimum: 100 },
                priority: { type: 'integer' },
                scopeDownStatement: { type: 'object' },
                forwardedIPConfig: {
                  type: 'object',
                  properties: {
                    headerName: {
                      type: 'string',
                      pattern: '^[a-zA-Z0-9-]+$',
                    },
                    fallbackBehavior: {
                      type: 'string',
                      enum: ['MATCH', 'NO_MATCH'],
                    },
                  },
                  required: ['headerName', 'fallbackBehavior'],
                },
                visibilityConfig: {
                  $ref: '#/definitions/visibilityConfig',
                },
              },
              required: [],
            },
          ],
        },
      },
      required: ['throttle'],
    },
    { $ref: '#/definitions/customWafRule' },
  ],
  errorMessage: 'must be a valid WAF rule',
};
// Depends on visibilityConfig
export const customWafRule = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    priority: { type: 'number' },
    action: {
      type: 'string',
      enum: ['Allow', 'Block', 'Count', 'Captcha'],
    },
    statement: { type: 'object', required: [] },
    visibilityConfig: { $ref: '#/definitions/visibilityConfig' },
  },
  required: ['name', 'statement'],
};

// Depends on stringOrIntrinsicFunction
export const environment = {
  type: 'object',
  additionalProperties: {
    $ref: '#/definitions/stringOrIntrinsicFunction',
  },
  required: [],
  errorMessage: 'must be a valid environment definition',
};
// Depends on dataSourceConfig
export const dataSource = {
  if: { type: 'object' },
  then: { $ref: '#/definitions/dataSourceConfig' },
  else: {
    type: 'string',
    errorMessage: 'must be a string or data source definition',
  },
};
// Depends on substitutions, resolverCachingConfig, dataSource, pipelineFunction
export const resolverConfig = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: ['UNIT', 'PIPELINE'],
      errorMessage: 'must be "UNIT" or "PIPELINE"',
    },
    type: { type: 'string' },
    field: { type: 'string' },
    maxBatchSize: { type: 'number', minimum: 1, maximum: 2000 },
    code: { type: 'string' },
    request: { type: 'string' },
    response: { type: 'string' },
    sync: { $ref: '#/definitions/syncConfig' },
    substitutions: { $ref: '#/definitions/substitutions' },
    caching: { $ref: '#/definitions/resolverCachingConfig' },
  },
  if: { properties: { kind: { const: 'UNIT' } }, required: ['kind'] },
  then: {
    properties: {
      dataSource: { $ref: '#/definitions/dataSource' },
    },
    required: ['dataSource'],
  },
  else: {
    properties: {
      functions: {
        type: 'array',
        items: { $ref: '#/definitions/pipelineFunction' },
      },
    },
    required: ['functions'],
  },
  required: [],
};
// Depends on resolverConfig
export const resolverConfigMap = {
  type: 'object',
  patternProperties: {
    // Type.field keys, type and field are not required
    '^[_A-Za-z][_0-9A-Za-z]*\\.[_A-Za-z][_0-9A-Za-z]*$': {
      $ref: '#/definitions/resolverConfig',
    },
  },
  additionalProperties: {
    // Other keys, type and field are required
    $merge: {
      source: { $ref: '#/definitions/resolverConfig' },
      with: { required: ['type', 'field'] },
    },
    errorMessage: {
      required: {
        type: 'resolver definitions that do not specify Type.field in the key must specify the type and field as properties',
        field:
          'resolver definitions that do not specify Type.field in the key must specify the type and field as properties',
      },
    },
  },
  required: [],
};
// Depends on dataSource
export const pipelineFunctionConfig = {
  type: 'object',
  properties: {
    dataSource: { $ref: '#/definitions/dataSource' },
    description: { type: 'string' },
    request: { type: 'string' },
    response: { type: 'string' },
    sync: { $ref: '#/definitions/syncConfig' },
    maxBatchSize: { type: 'number', minimum: 1, maximum: 2000 },
    substitutions: { $ref: '#/definitions/substitutions' },
  },
  required: ['dataSource'],
};
// Depends on pipelineFunctionConfig
export const pipelineFunction = {
  if: { type: 'object' },
  then: { $ref: '#/definitions/pipelineFunctionConfig' },
  else: {
    type: 'string',
    errorMessage: 'must be a string or function definition',
  },
};
// Depends on pipelineFunctionConfig
export const pipelineFunctionConfigMap = {
  type: 'object',
  additionalProperties: {
    if: { type: 'object' },
    then: { $ref: '#/definitions/pipelineFunctionConfig' },
    else: {
      type: 'string',
      errorMessage: 'must be a string or an object',
    },
  },
  required: [],
};
export const resolverCachingConfig = {
  oneOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        ttl: { type: 'integer', minimum: 1, maximum: 3600 },
        keys: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  ],
  errorMessage: 'must be a valid resolver caching config',
};
// Depends on lambdaFunctionConfig
export const syncConfig = {
  type: 'object',
  if: { properties: { conflictHandler: { const: ['LAMBDA'] } } },
  then: { $ref: '#/definitions/lambdaFunctionConfig' },
  properties: {
    functionArn: { type: 'string' },
    functionName: { type: 'string' },
    conflictDetection: { type: 'string', enum: ['VERSION', 'NONE'] },
    conflictHandler: {
      type: 'string',
      enum: ['LAMBDA', 'OPTIMISTIC_CONCURRENCY', 'AUTOMERGE'],
    },
  },
  required: [],
};
// Depends on stringOrIntrinsicFunction
export const iamRoleStatements = {
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
        errorMessage: 'contains invalid resolver definitions',
      },
    },
    required: ['Effect', 'Action', 'Resource'],
    errorMessage: 'must be a valid IAM role statement',
  },
};
// Depends on dataSourceDynamoDb, datasourceLambdaConfig, dataSourceHttpConfig, datasourceEsConfig, datasourceRelationalDbConfig and datasourceEventBridgeConfig
export const dataSourceConfig = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: DATASOURCE_TYPES,
      errorMessage: `must be one of ${DATASOURCE_TYPES.join(', ')}`,
    },
    description: { type: 'string' },
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
            type: { const: 'AMAZON_OPENSEARCH_SERVICE' },
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
          else: {
            if: { properties: { type: { const: 'AMAZON_EVENTBRIDGE' } } },
            then: {
              properties: {
                config: {
                  $ref: '#/definitions/datasourceEventBridgeConfig',
                },
              },
              required: ['config'],
            },
          },
        },
      },
    },
  },
  required: ['type'],
};
// Depends on stringOrIntrinsicFunction and iamRoleStatements
export const dataSourceHttpConfig = {
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
    },
  },
  required: ['endpoint'],
};
// Depends on stringOrIntrinsicFunction and iamRoleStatements
export const dataSourceDynamoDb = {
  type: 'object',
  properties: {
    tableName: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    useCallerCredentials: { type: 'boolean' },
    serviceRoleArn: {
      $ref: '#/definitions/stringOrIntrinsicFunction',
    },
    region: {
      $ref: '#/definitions/stringOrIntrinsicFunction',
    },
    iamRoleStatements: {
      $ref: '#/definitions/iamRoleStatements',
    },
    versioned: { type: 'boolean' },
    deltaSyncConfig: {
      type: 'object',
      properties: {
        deltaSyncTableName: { type: 'string' },
        baseTableTTL: { type: 'integer' },
        deltaSyncTableTTL: { type: 'integer' },
      },
      required: ['deltaSyncTableName'],
    },
  },
  required: ['tableName'],
};
// Depends on stringOrIntrinsicFunction and iamRoleStatements
export const datasourceRelationalDbConfig = {
  type: 'object',
  properties: {
    region: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    relationalDatabaseSourceType: {
      type: 'string',
      enum: ['RDS_HTTP_ENDPOINT'],
    },
    serviceRoleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    dbClusterIdentifier: {
      $ref: '#/definitions/stringOrIntrinsicFunction',
    },
    databaseName: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    schema: { type: 'string' },
    awsSecretStoreArn: {
      $ref: '#/definitions/stringOrIntrinsicFunction',
    },
    iamRoleStatements: {
      $ref: '#/definitions/iamRoleStatements',
    },
  },
  required: ['awsSecretStoreArn', 'dbClusterIdentifier'],
};
// Depends on lambdaFunctionConfig, stringOrIntrinsicFunction and iamRoleStatements
export const datasourceLambdaConfig = {
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
};
// Depends on stringOrIntrinsicFunction and iamRoleStatements
export const datasourceEsConfig = {
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
};
// Depends on stringOrIntrinsicFunction
export const datasourceEventBridgeConfig = {
  type: 'object',
  properties: {
    eventBusArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
  },
  required: ['eventBusArn'],
};

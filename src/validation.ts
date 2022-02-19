import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import ajvMergePatch from 'ajv-merge-patch';

const AUTH_TYPES = [
  'AMAZON_COGNITO_USER_POOLS',
  'AWS_LAMBDA',
  'OPENID_CONNECT',
  'AWS_IAM',
  'API_KEY',
] as const;

const DATASOURCE_TYPES = [
  'AMAZON_DYNAMODB',
  'AMAZON_OPENSEARCH_SERVICE',
  'AWS_LAMBDA',
  'HTTP',
  'NONE',
  'RELATIONAL_DATABASE',
] as const;

export const appSyncSchema = {
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
    },
    cognitoAuth: {
      type: 'object',
      properties: {
        userPoolId: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        awsRegion: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        defaultAction: {
          type: 'string',
          enum: ['ALLOW', 'DENY'],

          errorMessage: 'must be "ALLOW" or "DENY"',
        },
        appIdClientRegex: { type: 'string' },
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
        identityValidationExpression: { type: 'string' },
        authorizerResultTtlInSeconds: { type: 'number' },
      },
      required: [],
    },
    oidcAuth: {
      type: 'object',
      properties: {
        issuer: { type: 'string' },
        clientId: { type: 'string' },
        iatTTL: { type: 'number' },
        authTTL: { type: 'number' },
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
      },
      required: ['type'],
      errorMessage: 'is not a valid API_KEY config',
    },
    visibilityConfig: {
      type: 'object',
      properties: {
        cloudWatchMetricsEnabled: { type: 'boolean' },
        name: { type: 'string' },
        sampledRequestsEnabled: { type: 'boolean' },
      },
      required: [],
    },
    wafRule: {
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
                    name: { type: 'string' },
                    action: {
                      type: 'string',
                      enum: ['Allow', 'Block'],
                    },
                    aggregateKeyType: {
                      type: 'string',
                      enum: ['IP', 'FORWARDED_IP'],
                    },
                    limit: { type: 'integer' },
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
          required: [],
        },
        { $ref: '#/definitions/customWafRule' },
      ],
      errorMessage: 'is not a valid WAF rule',
    },
    customWafRule: {
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
    },
    mappingTemplate: {
      oneOf: [{ type: 'string' }, { type: 'boolean', const: false }],
      errorMessage: 'must be a string or false',
    },
    substitutions: {
      type: 'object',
      additionalProperties: {
        $ref: '#/definitions/stringOrIntrinsicFunction',
      },
      required: [],
      errorMessage: 'is not a valid substitutions definition',
    },
    dataSource: {
      if: { type: 'object' },
      then: { $ref: '#/definitions/dataSourceConfig' },
      else: {
        type: 'string',
        errorMessage: 'must be a string or data source definition',
      },
    },
    resolverConfig: {
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
        dataSource: { $ref: '#/definitions/dataSource' },
        functions: { type: 'array', items: { type: 'string' } },
        request: { $ref: '#/definitions/mappingTemplate' },
        response: { $ref: '#/definitions/mappingTemplate' },
        sync: { $ref: '#/definitions/syncConfig' },
        substitutions: { $ref: '#/definitions/substitutions' },
        caching: { $ref: '#/definitions/resolverCachingConfig' },
      },
      if: { properties: { kind: { const: 'PIPELINE' } }, required: ['kind'] },
      then: {
        required: ['functions'],
      },
      else: {
        required: ['dataSource'],
      },
      required: [],
    },
    resolverConfigMap: {
      type: 'object',
      patternProperties: {
        // Type.field keys, type and field are not required
        '^[_A-Za-z][_0-9A-Za-z]*\\.[_A-Za-z][_0-9A-Za-z]*$': {
          if: { type: 'object' },
          then: { $ref: '#/definitions/resolverConfig' },
          else: {
            type: 'string',
            errorMessage: 'must be a string or an object',
          },
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
    },
    pipelineFunctionConfig: {
      type: 'object',
      properties: {
        dataSource: { $ref: '#/definitions/dataSource' },
        description: { type: 'string' },
        request: { $ref: '#/definitions/mappingTemplate' },
        response: { $ref: '#/definitions/mappingTemplate' },
        sync: { $ref: '#/definitions/syncConfig' },
        maxBatchSize: { type: 'number', minimum: 1, maximum: 2000 },
        substitutions: { $ref: '#/definitions/substitutions' },
      },
      required: ['dataSource'],
    },
    pipelineFunctionConfigMap: {
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
    },
    resolverCachingConfig: {
      oneOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            ttl: { type: 'integer' },
            keys: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [],
        },
      ],
      errorMessage: 'is not a valid resolver caching config',
    },
    syncConfig: {
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
    },
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
            errorMessage: 'contains invalid resolver definitions',
          },
        },
        required: ['Effect', 'Action', 'Resource'],
        errorMessage: 'is not a valid IAM role statement',
      },
    },
    dataSourceConfig: {
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
        },
      },
      required: ['endpoint'],
    },
    dataSourceDynamoDb: {
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
    },
    datasourceRelationalDbConfig: {
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
    domain: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        useCloudFormation: { type: 'boolean' },
        retain: { type: 'boolean' },
        name: {
          type: 'string',
          pattern: '^([a-z][a-z0-9+-]*\\.){2,}[a-z][a-z0-9]*$',
          errorMessage: 'must be a valid domain name',
        },
        certificateArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        route53: {
          if: { type: 'object' },
          then: {
            type: 'object',
            properties: {
              hostedZoneId: { $ref: '#/definitions/stringOrIntrinsicFunction' },
              hostedZoneName: {
                type: 'string',
                pattern: '^([a-z][a-z0-9+-]*\\.){2,}$',
                errorMessage:
                  'must be a valid zone name. Note: you must include a trailing dot (eg: `example.com.`)',
              },
            },
          },
          else: {
            type: 'boolean',
            errorMessage: 'must be a boolean or a route53 configuration object',
          },
        },
      },
    },
    xrayEnabled: { type: 'boolean' },
    substitutions: { $ref: '#/definitions/substitutions' },
    waf: {
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
      required: ['rules'],
      errorMessage: 'is not a valid WAF config',
    },
    tags: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    caching: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
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
    additionalAuthentications: {
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
    log: {
      type: 'object',
      properties: {
        roleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
        level: {
          type: 'string',
          enum: ['ALL', 'ERROR', 'NONE'],
          errorMessage: 'must be "ALL", "ERROR" or "NONE"',
        },
        logRetentionInDays: { type: 'integer' },
        excludeVerboseContent: { type: 'boolean' },
      },
      required: ['level'],
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
      oneOf: [
        { $ref: '#/definitions/resolverConfigMap' },
        {
          type: 'array',
          items: { $ref: '#/definitions/resolverConfigMap' },
        },
      ],
      errorMessage: 'contains invalid resolver definitions',
    },
    pipelineFunctions: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/pipelineFunctionConfig',
          },
        },
        {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: {
              $ref: '#/definitions/pipelineFunctionConfig',
            },
          },
        },
      ],
      errorMessage: 'contains invalid pipeline function definitions',
    },
  },
  required: ['name', 'authentication'],
  additionalProperties: {
    not: true,
    errorMessage: 'invalid (unknown) property',
  },
};

const ajv = new Ajv({ allErrors: true });
ajvMergePatch(ajv);
ajvErrors(ajv);

const validator = ajv.compile(appSyncSchema);
export const validateConfig = (data: Record<string, unknown>) => {
  const isValid = validator(data);
  if (isValid === false && validator.errors) {
    throw new AppSyncValidationError(
      validator.errors
        .filter(
          (error) =>
            !['if', 'oneOf', 'anyOf', '$merge'].includes(error.keyword),
        )
        .map((error) => {
          return {
            path: error.instancePath,
            message: error.message || 'unknown error',
          };
        }),
    );
  }

  return isValid;
};

export class AppSyncValidationError extends Error {
  constructor(public validationErrors: { path: string; message: string }[]) {
    super(
      validationErrors
        .map((error) => `${error.path}: ${error.message}`)
        .join('\n'),
    );
    Object.setPrototypeOf(this, AppSyncValidationError.prototype);
  }
}

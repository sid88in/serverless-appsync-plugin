import { timeUnits } from '../utils.js';

export const name = { type: 'string' };
// Depends on auth
export const authentication = { $ref: '#/definitions/auth' };
export const schema = {
  anyOf: [
    {
      type: 'string',
    },
    {
      type: 'array',
      items: { type: 'string' },
    },
  ],
  errorMessage: 'must be a valid schema config',
};
//Depends on stringOrIntrinsicFunction
export const domain = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
    useCloudFormation: { type: 'boolean' },
    retain: { type: 'boolean' },
    name: {
      type: 'string',
      pattern: '^([a-z][a-z0-9+-]*\\.)+[a-z][a-z0-9]*$',
      errorMessage: 'must be a valid domain name',
    },
    certificateArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    hostedZoneId: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    hostedZoneName: {
      type: 'string',
      pattern: '^([a-z][a-z0-9+-]*\\.)+[a-z][a-z0-9]*\\.$',
      errorMessage:
        'must be a valid zone name. Note: you must include a trailing dot (eg: `example.com.`)',
    },
    route53: { type: 'boolean' },
  },
  required: ['name'],
  if: {
    anyOf: [
      {
        not: { properties: { useCloudFormation: { const: false } } },
      },
      { not: { required: ['useCloudFormation'] } },
    ],
  },
  then: {
    anyOf: [{ required: ['certificateArn'] }, { required: ['hostedZoneId'] }],
    errorMessage:
      'when using CloudFormation, you must provide either certificateArn or hostedZoneId.',
  },
};
export const xrayEnabled = { type: 'boolean' };
export const visibility = {
  type: 'string',
  enum: ['GLOBAL', 'PRIVATE'],
  errorMessage: 'must be "GLOBAL" or "PRIVATE"',
};
export const introspection = { type: 'boolean' };
export const queryDepthLimit = { type: 'integer', minimum: 1, maximum: 75 };
export const resolverCountLimit = {
  type: 'integer',
  minimum: 1,
  maximum: 1000,
};
// Depends on substitutions
export const substitutions = { $ref: '#/definitions/substitutions' };
// Depends on environment
export const environment = { $ref: '#/definitions/environment' };
// Depends on stringOrIntrinsicFunction and wafRule
export const waf = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
  },
  if: {
    required: ['arn'],
  },
  then: {
    properties: {
      arn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    },
  },
  else: {
    properties: {
      name: { type: 'string' },
      defaultAction: {
        type: 'string',
        enum: ['Allow', 'Block'],
        errorMessage: "must be 'Allow' or 'Block'",
      },
      description: { type: 'string' },
      rules: {
        type: 'array',
        items: { $ref: '#/definitions/wafRule' },
      },
    },
    required: ['rules'],
  },
};
export const tags = {
  type: 'object',
  additionalProperties: { type: 'string' },
};
export const caching = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
    behavior: {
      type: 'string',
      enum: ['FULL_REQUEST_CACHING', 'PER_RESOLVER_CACHING'],
      errorMessage:
        "must be one of 'FULL_REQUEST_CACHING', 'PER_RESOLVER_CACHING'",
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
      errorMessage:
        "must be one of 'SMALL', 'MEDIUM', 'LARGE', 'XLARGE', 'LARGE_2X', 'LARGE_4X', 'LARGE_8X', 'LARGE_12X'",
    },
    ttl: { type: 'integer', minimum: 1, maximum: 3600 },
    atRestEncryption: { type: 'boolean' },
    transitEncryption: { type: 'boolean' },
  },
  required: ['behavior'],
};
// Depends on auth
export const additionalAuthentications = {
  type: 'array',
  items: { $ref: '#/definitions/auth' },
};
// Depends on wafRule
export const apiKeys = {
  type: 'array',
  items: {
    if: { type: 'object' },
    then: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        expiresAfter: {
          type: ['string', 'number'],
          pattern: `^(\\d+)(${Object.keys(timeUnits).join('|')})?$`,
          errorMessage: 'must be a valid duration.',
        },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          errorMessage: 'must be a valid date-time',
        },
        wafRules: {
          type: 'array',
          items: { $ref: '#/definitions/wafRule' },
        },
      },
      required: ['name'],
    },
    else: {
      type: 'string',
    },
  },
};
// Depends on stringOrIntrinsicFunction
export const logging = {
  type: 'object',
  properties: {
    roleArn: { $ref: '#/definitions/stringOrIntrinsicFunction' },
    level: {
      type: 'string',
      enum: ['ALL', 'INFO', 'DEBUG', 'ERROR', 'NONE'],
      errorMessage: "must be one of 'ALL', 'INFO', 'DEBUG', 'ERROR' or 'NONE'",
    },
    retentionInDays: { type: 'integer' },
    excludeVerboseContent: { type: 'boolean' },
    enabled: { type: 'boolean' },
  },
  required: ['level'],
};
// Depends on dataSourceConfig
export const dataSources = {
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
};
// Depends on resolverConfigMap
export const resolvers = {
  oneOf: [
    { $ref: '#/definitions/resolverConfigMap' },
    {
      type: 'array',
      items: { $ref: '#/definitions/resolverConfigMap' },
    },
  ],
  errorMessage: 'contains invalid resolver definitions',
};
// Depends on pipelineFunctionConfigMap
export const pipelineFunctions = {
  oneOf: [
    {
      $ref: '#/definitions/pipelineFunctionConfigMap',
    },
    {
      type: 'array',
      items: {
        $ref: '#/definitions/pipelineFunctionConfigMap',
      },
    },
  ],
  errorMessage: 'contains invalid pipeline function definitions',
};
// Depends on stringOrIntrinsicFunction
export const esbuild = {
  oneOf: [
    {
      type: 'object',
    },
    { const: false },
  ],
  errorMessage: 'must be an esbuild config object or false',
};
export const apiId = { $ref: '#/definitions/stringOrIntrinsicFunction' };

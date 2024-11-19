import Ajv, { type ValidateFunction } from 'ajv';
import ajvErrors from 'ajv-errors';
import ajvMergePatch from 'ajv-merge-patch';
import addFormats from 'ajv-formats';
import * as def from './validation/definitions.js';
import * as prop from './validation/properties.js';

const commonProperties = {
  substitutions: prop.substitutions,
  dataSources: prop.dataSources,
  resolvers: prop.resolvers,
  pipelineFunctions: prop.pipelineFunctions,
};

const definitions = {
  stringOrIntrinsicFunction: def.stringOrIntrinsicFunction,
  substitutions: def.substitutions,
  lambdaFunctionConfig: def.lambdaFunctionConfig,
  dataSource: def.dataSource,
  resolverConfig: def.resolverConfig,
  resolverConfigMap: def.resolverConfigMap,
  pipelineFunctionConfig: def.pipelineFunctionConfig,
  pipelineFunction: def.pipelineFunction,
  pipelineFunctionConfigMap: def.pipelineFunctionConfigMap,
  resolverCachingConfig: def.resolverCachingConfig,
  iamRoleStatements: def.iamRoleStatements,
  dataSourceConfig: def.dataSourceConfig,
  dataSourceHttpConfig: def.dataSourceHttpConfig,
  dataSourceDynamoDb: def.dataSourceDynamoDb,
  datasourceRelationalDbConfig: def.datasourceRelationalDbConfig,
  datasourceLambdaConfig: def.datasourceLambdaConfig,
  datasourceEsConfig: def.datasourceEsConfig,
  datasourceEventBridgeConfig: def.datasourceEventBridgeConfig,
  auth: def.auth,
  cognitoAuth: def.cognitoAuth,
  lambdaAuth: def.lambdaAuth,
  oidcAuth: def.oidcAuth,
  iamAuth: def.iamAuth,
  apiKeyAuth: def.apiKeyAuth,
  visibilityConfig: def.visibilityConfig,
  wafRule: def.wafRule,
  customWafRule: def.customWafRule,
  environment: def.environment,
  syncConfig: def.syncConfig,
};

export const sharedAppSyncSchema = {
  type: 'object',
  definitions,
  properties: {
    ...commonProperties,
    apiId: { type: 'string' },
  },
  required: ['apiId'],
  additionalProperties: {
    not: true,
    errorMessage: 'invalid (unknown) property',
  },
};

export const fullAppSyncSchema = {
  type: 'object',
  definitions,
  properties: {
    ...commonProperties,
    name: prop.name,
    authentication: prop.authentication,
    schema: prop.schema,
    domain: prop.domain,
    xrayEnabled: prop.xrayEnabled,
    visibility: prop.visibility,
    introspection: prop.introspection,
    queryDepthLimit: prop.queryDepthLimit,
    resolverCountLimit: prop.resolverCountLimit,
    environment: prop.environment,
    waf: prop.waf,
    tags: prop.tags,
    caching: prop.caching,
    additionalAuthentications: prop.additionalAuthentications,
    apiKeys: prop.apiKeys,
    logging: prop.logging,
    esbuild: prop.esbuild,
  },
  required: ['name', 'authentication'],
  additionalProperties: {
    not: true,
    errorMessage: 'invalid (unknown) property',
  },
};

// const appSyncSchema = {

//   oneOf: [sharedAppSyncSchema, fullAppSyncSchema],
// };

const createValidator = (schema: object) => {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  ajvMergePatch(ajv);
  ajvErrors(ajv);
  addFormats(ajv);
  return ajv.compile(schema);
};

const sharedValidator = createValidator(sharedAppSyncSchema);
const fullValidator = createValidator(fullAppSyncSchema);

export const validateConfig = (data: Record<string, unknown>) => {
  let isValid: boolean;
  let validator: ValidateFunction;

  if ('apiId' in data) {
    isValid = sharedValidator(data);
    validator = sharedValidator;
  } else if ('name' in data) {
    isValid = fullValidator(data);
    validator = fullValidator;
  } else {
    throw new Error(
      'Invalid configuration: must contain either "apiId" or "name"',
    );
  }

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

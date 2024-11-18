import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import ajvMergePatch from 'ajv-merge-patch';
import addFormats from 'ajv-formats';
import * as definitions from './validation/definitions';
import * as properties from './validation/properties';

export const fullAppSyncSchema = {
  type: 'object',
  definitions: {
    stringOrIntrinsicFunction: definitions.stringOrIntrinsicFunction,
    lambdaFunctionConfig: definitions.lambdaFunctionConfig,
    auth: definitions.auth,
    cognitoAuth: definitions.cognitoAuth,
    lambdaAuth: definitions.lambdaAuth,
    oidcAuth: definitions.oidcAuth,
    iamAuth: definitions.iamAuth,
    apiKeyAuth: definitions.apiKeyAuth,
    visibilityConfig: definitions.visibilityConfig,
    wafRule: definitions.wafRule,
    customWafRule: definitions.customWafRule,
    substitutions: definitions.substitutions,
    environment: definitions.environment,
    dataSource: definitions.dataSource,
    resolverConfig: definitions.resolverConfig,
    resolverConfigMap: definitions.resolverConfigMap,
    pipelineFunctionConfig: definitions.pipelineFunctionConfig,
    pipelineFunction: definitions.pipelineFunction,
    pipelineFunctionConfigMap: definitions.pipelineFunctionConfigMap,
    resolverCachingConfig: definitions.resolverCachingConfig,
    syncConfig: definitions.syncConfig,
    iamRoleStatements: definitions.iamRoleStatements,
    dataSourceConfig: definitions.dataSourceConfig,
    dataSourceHttpConfig: definitions.dataSourceHttpConfig,
    dataSourceDynamoDb: definitions.dataSourceDynamoDb,
    datasourceRelationalDbConfig: definitions.datasourceRelationalDbConfig,
    datasourceLambdaConfig: definitions.datasourceLambdaConfig,
    datasourceEsConfig: definitions.datasourceEsConfig,
    datasourceEventBridgeConfig: definitions.datasourceEventBridgeConfig,
  },
  properties: {
    name: properties.name,
    authentication: properties.authentication,
    schema: properties.schema,
    domain: properties.domain,
    xrayEnabled: properties.xrayEnabled,
    visibility: properties.visibility,
    introspection: properties.introspection,
    queryDepthLimit: properties.queryDepthLimit,
    resolverCountLimit: properties.resolverCountLimit,
    substitutions: properties.substitutions,
    environment: properties.environment,
    waf: properties.waf,
    tags: properties.tags,
    caching: properties.caching,
    additionalAuthentications: properties.additionalAuthentications,
    apiKeys: properties.apiKeys,
    logging: properties.logging,
    dataSources: properties.dataSources,
    resolvers: properties.resolvers,
    pipelineFunctions: properties.pipelineFunctions,
    esbuild: properties.esbuild,
  },
  required: ['name'],
  additionalProperties: {
    not: true,
    errorMessage: 'invalid (unknown) property',
  },
};
export const sharedAppSyncSchema = {
  type: 'object',
  definitions: {
    stringOrIntrinsicFunction: definitions.stringOrIntrinsicFunction,
    lambdaFunctionConfig: definitions.lambdaFunctionConfig,
    substitutions: definitions.substitutions,
    dataSource: definitions.dataSource,
    resolverConfig: definitions.resolverConfig,
    resolverConfigMap: definitions.resolverConfigMap,
    pipelineFunctionConfig: definitions.pipelineFunctionConfig,
    pipelineFunction: definitions.pipelineFunction,
    pipelineFunctionConfigMap: definitions.pipelineFunctionConfigMap,
    resolverCachingConfig: definitions.resolverCachingConfig,
    iamRoleStatements: definitions.iamRoleStatements,
    dataSourceConfig: definitions.dataSourceConfig,
    dataSourceHttpConfig: definitions.dataSourceHttpConfig,
    dataSourceDynamoDb: definitions.dataSourceDynamoDb,
    datasourceRelationalDbConfig: definitions.datasourceRelationalDbConfig,
    datasourceLambdaConfig: definitions.datasourceLambdaConfig,
    datasourceEsConfig: definitions.datasourceEsConfig,
    datasourceEventBridgeConfig: definitions.datasourceEventBridgeConfig,
  },
  properties: {
    substitutions: properties.substitutions,
    dataSources: properties.dataSources,
    resolvers: properties.resolvers,
    pipelineFunctions: properties.pipelineFunctions,
    apiId: { type: 'string' }, // properties.apiId, // TODO: Handle intrinsic function
  },
  required: ['apiId'],
  additionalProperties: {
    not: true,
    errorMessage: 'invalid (unknown) property',
  },
};

const appSyncSchema = {
  oneOf: [sharedAppSyncSchema, fullAppSyncSchema],
};

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
ajvMergePatch(ajv);
ajvErrors(ajv);
addFormats(ajv);

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

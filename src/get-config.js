const fs = require('fs');
const path = require('path');
const { mergeTypeDefs } = require('@graphql-tools/merge');
const {
  mapObjIndexed, pipe, values, merge,
} = require('ramda');

const objectToArrayWithNameProp = pipe(
  mapObjIndexed((item, key) => merge({ name: key }, item)),
  values,
);

const mergeTypes = (types, options) => {
  const schemaDefinition = options && typeof options.schemaDefinition === 'boolean'
    ? options.schemaDefinition
    : true;
  return mergeTypeDefs(types, {
    useSchemaDefinition: schemaDefinition,
    forceSchemaDefinition: schemaDefinition,
    throwOnConflict: true,
    commentDescriptions: true,
    reverseDirectives: true,
    ...options,
  });
};

const getConfig = (config, provider, servicePath) => {
  if (
    !(
      config.authenticationType === 'API_KEY' ||
      config.authenticationType === 'AWS_IAM' ||
      config.authenticationType === 'AMAZON_COGNITO_USER_POOLS' ||
      config.authenticationType === 'OPENID_CONNECT'
    )
  ) {
    throw new Error('appSync property `authenticationType` is missing or invalid.');
  }
  if (config.authenticationType === 'AMAZON_COGNITO_USER_POOLS' && !config.userPoolConfig) {
    throw new Error('appSync property `userPoolConfig` is required when authenticationType `AMAZON_COGNITO_USER_POOLS` is chosen.');
  }
  if (config.authenticationType === 'OPENID_CONNECT' && !config.openIdConnectConfig) {
    throw new Error('appSync property `openIdConnectConfig` is required when authenticationType `OPENID_CONNECT` is chosenXXX.');
  }

  if (config.logConfig && !config.logConfig.level) {
    throw new Error('logConfig property `level` must be NONE, ERROR, or ALL when logConfig exists.');
  }
  if (config.substitutions && typeof config.substitutions !== 'object') {
    throw new Error('substitutions property must be an object');
  }
  if (config.xrayEnabled && typeof config.xrayEnabled !== 'boolean') {
    throw new Error('xrayEnabled must be a boolean');
  }

  const mappingTemplatesLocation = config.mappingTemplatesLocation || 'mapping-templates';
  const functionConfigurationsLocation = config.functionConfigurationsLocation
    || mappingTemplatesLocation;
  const functionConfigurations = config.functionConfigurations || [];
  const mappingTemplates = config.mappingTemplates || [];

  const readSchemaFile =
      schemaRelPath => fs.readFileSync(path.join(servicePath, schemaRelPath), { encoding: 'utf8' });

  const schemaContent =
    Array.isArray(config.schema) ?
      mergeTypes(config.schema.map(readSchemaFile)) :
      readSchemaFile(config.schema || 'schema.graphql');

  let dataSources = [];
  if (Array.isArray(config.dataSources)) {
    dataSources = config.dataSources.reduce(
      (acc, value) => {
        // Do not call `objectToArrayWithNameProp` on datasources objects``
        if (value.name !== undefined && typeof value.name === 'string') {
          return acc.concat(value);
        }
        return acc.concat(objectToArrayWithNameProp(value));
      },
      [],
    );
  } else {
    dataSources = objectToArrayWithNameProp(config.dataSources);
  }

  return {
    ...config,
    name: config.name || 'api',
    region: provider.region,
    authenticationType: config.authenticationType,
    additionalAuthenticationProviders: config.additionalAuthenticationProviders || [],
    schema: schemaContent,
    // TODO verify dataSources structure
    dataSources,
    defaultMappingTemplates: config.defaultMappingTemplates || {},
    mappingTemplatesLocation,
    mappingTemplates,
    functionConfigurationsLocation,
    functionConfigurations,
    substitutions: config.substitutions || {},
    xrayEnabled: config.xrayEnabled || false,
  };
};


module.exports = (config, provider, servicePath) => {
  if (!config) {
    return [];
  } else if (config.constructor === Array) {
    return config.map(apiConfig => getConfig(apiConfig, provider, servicePath));
  }
  const singleConfig = getConfig(config, provider, servicePath);
  singleConfig.isSingleConfig = true;
  return [singleConfig];
};

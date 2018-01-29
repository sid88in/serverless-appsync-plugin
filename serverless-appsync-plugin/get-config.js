const fs = require('fs');
const path = require('path');
const { mapObjIndexed, pipe, values, merge } = require('ramda');

const objectToArrayWithNameProp = pipe(
  mapObjIndexed((item, key) => merge({ name: key }, item)),
  values
);

module.exports = (config, provider, servicePath) => {
  // TODO verify authenticationType
  if (!config.authenticationType) {
    throw new Error('appSync property `authenticationType` is required.');
  }
  if (!config.serviceRole) {
    throw new Error('appSync property `serviceRole` is required.');
  }
  if (
    config.authenticationType === 'AMAZON_COGNITO_USER_POOLS' &&
    !config.userPoolConfig
  ) {
    throw new Error(
      'appSync property `userPoolConfig` is required when authenticationType `AMAZON_COGNITO_USER_POOLS` is chosen.'
    );
  }

  const mappingTemplatePath = path.join(
    servicePath,
    config.mappingTemplates || 'mapping-templates'
  );
  const fileNames = fs.readdirSync(mappingTemplatePath);

  const mappingTemplates = fileNames.reduce((obj, fileName) => {
    obj[fileName] = fs.readFileSync(path.join(mappingTemplatePath, fileName), {
      encoding: 'utf8'
    });
    return obj;
  }, {});

  const schemaPath = path.join(servicePath, config.schema || 'schema.graphql');
  const schemaContent = fs.readFileSync(schemaPath, {
    encoding: 'utf8'
  });

  const dataSources = objectToArrayWithNameProp(config.dataSources);

  return {
    name: config.name || 'api',
    region: provider.region,
    authenticationType: config.authenticationType,
    schema: schemaContent,
    userPoolConfig: config.userPoolConfig,
    // TODO verify dataSources structure
    dataSources,
    mappingTemplates
  };
};

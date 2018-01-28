module.exports = (config, provider) => {
  // TODO verify authenticationType
  if (!config.serviceRole) {
    throw new Error('appSync property `serviceRole` is required.');
  }
  if (!config.authenticationType) {
    throw new Error('appSync property `authenticationType` is required.');
  }

  // TODO verify dataSources structure

  // TODO read out mapping templates from
  // path.join(serviceDir, mapping-templates)
  const mappingTemplates = {};

  return {
    name: config.name || 'api',
    region: provider.region,
    authenticationType: config.authenticationType,
    schema: config.schema || 'schema.graphql',
    dataSources: config.dataSources,
    mappingTemplates
  };
};

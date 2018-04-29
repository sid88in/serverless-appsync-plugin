const fs = require('fs');
// const { join } = require('path');
const {
  generateVelocityTemplate,
  getFieldType,
} = require('./lib/codegen/index');

module.exports = async (config) => {
  const { mappingTemplatesLocation } = config.resolvedConfig;
  const mtDir = mappingTemplatesLocation;
  if (!fs.existsSync(mtDir)) {
    fs.mkdirSync(mtDir);
  }
  let generatedMTs = [];
  const ps = config.dataSources.map(async (ds) => {
    if (ds.fields) {
      const dsMt = ds.fields.map(async (field) => {
        generateVelocityTemplate({
          field,
          mappingTemplatesLocation,
          dataSourceType: ds.type,
        });
        return {
          dataSource: ds.name,
          field,
          request: `${field}-request-mapping-template.txt`,
          response: 'response-mapping-template.txt',
          type: (await getFieldType(config.schema, field)),
        };
      });
      const dsGeneratedMTs = await Promise.all(dsMt);
      generatedMTs = [
        ...generatedMTs,
        ...dsGeneratedMTs,
      ];
    }
  });
  generateVelocityTemplate({ type: 'response', mappingTemplatesLocation });
  await Promise.all(ps);
  return [
    ...config.resolvedConfig.mappingTemplates,
    ...generatedMTs,
  ];
};

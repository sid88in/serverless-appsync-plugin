const fs = require('fs');
const { join } = require('path');

const { introspectSchema } = require('apollo-codegen');
const ejs = require('ejs');

const generateVelocityTemplate = ({
  type = 'request', dataSourceType = 'AWS_LAMBDA', field, mappingTemplatesLocation,
}) => {
  const template = fs.readFileSync(join(__dirname, `${dataSourceType}-${type}-mapping-template.tmpl.ejs`), 'utf-8');
  const mtContents = ejs.render(template, field ? { field } : {});
  const outPath = join(mappingTemplatesLocation, `${field ? `${field}-` : ''}${type}-mapping-template.txt`);
  fs.writeFileSync(outPath, mtContents, 'utf-8');
};

const getFieldType = async (schemaLocation, field) => {
  const appSyncDir = join(__dirname, '.appsync');
  if (!fs.existsSync(appSyncDir)) {
    fs.mkdirSync(appSyncDir);
  }

  await introspectSchema(
    schemaLocation,
    join(appSyncDir, 'schema.json'),
  );

  /* eslint-disable no-underscore-dangle */
  /* eslint-disable global-require */
  const schema = require('./.appsync/schema.json').data.__schema;
  /* eslint-enable global-require */
  /* eslint-enable no-underscore-dangle */

  let type;
  /* eslint-disable array-callback-return */
  schema.types.map((y) => {
    if (
      !type &&
      (y.name === schema.queryType.name ||
      y.name === schema.mutationType.name)
    ) {
      // console.log(y);
      const found = y.fields.find(f => f.name === field);
      if (found) {
        /* eslint-disable no-nested-ternary */
        type = y.name === schema.queryType.name ? 'Query' : (
          y.name === schema.mutationType.name ? 'Mutation' : 'Subscription'
        );
        /* eslint-enable no-nested-ternary */
      }
    }
  });
  /* eslint-enable array-callback-return */
  if (!type) {
    throw new Error(`Field '${field}' cannot found in schema`);
  }
  return type;
};

module.exports = {
  generateVelocityTemplate,
  getFieldType,
};

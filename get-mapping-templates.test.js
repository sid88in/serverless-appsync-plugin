const getMappingTemplates = require('./get-mapping-templates');

test('Returns valid mapping templates conf', async () => {
  expect(await getMappingTemplates({
    schema: './example/schema.graphql',
    resolvedConfig: {
      mappingTemplatesLocation: '__test__mapping-templates',
      mappingTemplates: [],
    },
    dataSources: [
      {
        name: 'Lambda',
        description: 'Lambda DataSource',
        autogeneration: false,
        fields: ['meInfo', 'deleteTweet'],
      },
    ],
  })).toMatchSnapshot();
});

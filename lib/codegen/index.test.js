const { getFieldType } = require('./');

describe('getFieldType returns correct type', () => {
  test('getFieldType returns correct type for queries', async () => {
    expect(await getFieldType('./example/schema.graphql', 'meInfo')).toBe('Query');
  });
  test('getFieldType returns correct type for mutations', async () => {
    expect(await getFieldType('./example/schema.graphql', 'createTweet')).toBe('Mutation');
  });

  test('getFieldType throws error if field not found', async () => {
    let error;
    try {
      await getFieldType('./example/schema.graphql', 'nonexistentField');
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(new Error('Field \'nonexistentField\' cannot found in schema'));
  });
});

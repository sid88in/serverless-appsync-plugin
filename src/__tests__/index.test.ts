import * as given from './given';

const plugin = given.plugin();

describe('variable', () => {
  it('should resolve the api id', () => {
    expect(
      plugin.resolveVariable({
        address: 'id',
        options: {},
        resolveVariable: () => '',
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "value": Object {
          "Fn::GetAtt": Array [
            "GraphQlApi",
            "ApiId",
          ],
        },
      }
    `);
  });

  it('should resolve the api url', () => {
    expect(
      plugin.resolveVariable({
        address: 'url',
        options: {},
        resolveVariable: () => '',
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "value": Object {
          "Fn::GetAtt": Array [
            "GraphQlApi",
            "GraphQLUrl",
          ],
        },
      }
    `);
  });

  it('should resolve the api arn', () => {
    expect(
      plugin.resolveVariable({
        address: 'arn',
        options: {},
        resolveVariable: () => '',
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "value": Object {
          "Fn::GetAtt": Array [
            "GraphQlApi",
            "Arn",
          ],
        },
      }
    `);
  });

  it('should resolve an api key', () => {
    expect(
      plugin.resolveVariable({
        address: 'apiKey.foo',
        options: {},
        resolveVariable: () => '',
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "value": Object {
          "Fn::GetAtt": Array [
            "GraphQlApifoo",
            "ApiKey",
          ],
        },
      }
    `);
  });
});

import { Api } from '../resources/Api';
import { MappingTemplate } from '../resources/MappingTemplate';
import * as given from './given';
import fs from 'fs';

const plugin = given.plugin();

describe('Mapping Templates', () => {
  let mock: jest.SpyInstance;
  let mockEists: jest.SpyInstance;

  beforeEach(() => {
    mock = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(
        (path) => `Content of ${`${path}`.replace(/\\/g, '/')}`,
      );
    mockEists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  afterEach(() => {
    mock.mockRestore();
    mockEists.mockRestore();
  });

  it('should substitute variables', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const mapping = new MappingTemplate(api, {
      path: 'foo.vtl',
      substitutions: {
        foo: 'bar',
        var: { Ref: 'MyReference' },
      },
    });
    const template =
      'Foo: ${foo}, Var: ${var}, Context: ${ctx.args.id}, Unknonw: ${unknown}';
    expect(mapping.processTemplateSubstitutions(template))
      .toMatchInlineSnapshot(`
      Object {
        "Fn::Join": Array [
          "",
          Array [
            "Foo: ",
            Object {
              "Fn::Sub": Array [
                "\${foo}",
                Object {
                  "foo": "bar",
                },
              ],
            },
            ", Var: ",
            Object {
              "Fn::Sub": Array [
                "\${var}",
                Object {
                  "var": Object {
                    "Ref": "MyReference",
                  },
                },
              ],
            },
            ", Context: \${ctx.args.id}, Unknonw: \${unknown}",
          ],
        ],
      }
    `);
  });

  it('should substitute variables and use defaults', () => {
    const api = new Api(
      given.appSyncConfig({
        substitutions: {
          foo: 'bar',
          var: 'bizz',
        },
      }),
      plugin,
    );
    const mapping = new MappingTemplate(api, {
      path: 'foo.vtl',
      substitutions: {
        foo: 'fuzz',
      },
    });
    const template = 'Foo: ${foo}, Var: ${var}';
    expect(mapping.processTemplateSubstitutions(template))
      .toMatchInlineSnapshot(`
      Object {
        "Fn::Join": Array [
          "",
          Array [
            "Foo: ",
            Object {
              "Fn::Sub": Array [
                "\${foo}",
                Object {
                  "foo": "fuzz",
                },
              ],
            },
            ", Var: ",
            Object {
              "Fn::Sub": Array [
                "\${var}",
                Object {
                  "var": "bizz",
                },
              ],
            },
          ],
        ],
      }
    `);
  });

  it('should fail if template is missing', () => {
    mockEists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const api = new Api(given.appSyncConfig(), plugin);
    const mapping = new MappingTemplate(api, {
      path: 'foo.vtl',
      substitutions: {
        foo: 'bar',
        var: { Ref: 'MyReference' },
      },
    });

    expect(function () {
      mapping.compile();
    }).toThrowErrorMatchingInlineSnapshot(
      `"Mapping template file 'foo.vtl' does not exist"`,
    );
  });
});

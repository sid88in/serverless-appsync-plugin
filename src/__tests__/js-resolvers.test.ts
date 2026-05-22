import { Api } from '../resources/Api';
import { JsResolver } from '../resources/JsResolver';
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
    const mapping = new JsResolver(api, {
      path: 'foo.vtl',
      substitutions: {
        foo: 'bar',
        var: { Ref: 'MyReference' },
      },
    });
    const template = `const foo = '#foo#';
       const var = '#var#';
       const unknonw = '#unknown#'`;
    expect(mapping.processTemplateSubstitutions(template))
      .toMatchInlineSnapshot(`
      {
        "Fn::Join": [
          "",
          [
            "const foo = '",
            {
              "Fn::Sub": [
                "\${foo}",
                {
                  "foo": "bar",
                },
              ],
            },
            "';
             const var = '",
            {
              "Fn::Sub": [
                "\${var}",
                {
                  "var": {
                    "Ref": "MyReference",
                  },
                },
              ],
            },
            "';
             const unknonw = '#unknown#'",
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
    const mapping = new JsResolver(api, {
      path: 'foo.vtl',
      substitutions: {
        foo: 'fuzz',
      },
    });
    const template = `const foo = '#foo#';
    const var = '#var#';`;
    expect(mapping.processTemplateSubstitutions(template))
      .toMatchInlineSnapshot(`
      {
        "Fn::Join": [
          "",
          [
            "const foo = '",
            {
              "Fn::Sub": [
                "\${foo}",
                {
                  "foo": "fuzz",
                },
              ],
            },
            "';
          const var = '",
            {
              "Fn::Sub": [
                "\${var}",
                {
                  "var": "bizz",
                },
              ],
            },
            "';",
          ],
        ],
      }
    `);
  });

  it('should fail if template is missing', () => {
    mockEists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const api = new Api(given.appSyncConfig(), plugin);
    const mapping = new JsResolver(api, {
      path: 'foo.vtl',
      substitutions: {
        foo: 'bar',
        var: { Ref: 'MyReference' },
      },
    });

    expect(function () {
      mapping.compile();
    }).toThrowErrorMatchingInlineSnapshot(
      `"The resolver handler file 'foo.vtl' does not exist"`,
    );
  });
});

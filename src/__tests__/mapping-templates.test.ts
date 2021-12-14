import { MappingTemplate } from 'resources/MappingTemplate';

describe('Mapping Templates', () => {
  it('should substritute default variables', () => {
    const mapping = new MappingTemplate({
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
});

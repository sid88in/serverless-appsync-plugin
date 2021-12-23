import fs from 'fs';
import { Api } from '../resources/Api';
import * as given from './given';

const plugin = given.plugin();

describe('Resolvers', () => {
  let mock: jest.SpyInstance;
  beforeAll(() => {
    mock = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(
        (path) => `Content of ${`${path}`.replace(/\\/g, '/')}`,
      );
  });

  afterAll(() => {
    mock.mockRestore();
  });

  describe('Unit Resolvers', () => {
    it('should generate Resources with default mapping templates', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compileResolver({
          dataSource: 'myTable',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "DataSourceName": "myTable",
              "FieldName": "user",
              "Kind": "UNIT",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/Query.user.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/Query.user.response.vtl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with default specific templates', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compileResolver({
          dataSource: 'myTable',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          request: 'specific.request.tpl',
          response: 'specific.response.tpl',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "DataSourceName": "myTable",
              "FieldName": "user",
              "Kind": "UNIT",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/specific.request.tpl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/specific.response.tpl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with direct Lambda templates', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compileResolver({
          dataSource: 'myLambdaFunction',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          request: 'specific.request.tpl',
          response: 'specific.response.tpl',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "DataSourceName": "myLambdaFunction",
              "FieldName": "user",
              "Kind": "UNIT",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/specific.request.tpl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/specific.response.tpl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });
  });

  describe('Pipeline Resovlers', () => {
    it('should generate Resources with default mapping templates', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compileResolver({
          kind: 'PIPELINE',
          type: 'Query',
          field: 'user',
          functions: ['function1', 'function2'],
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "FieldName": "user",
              "Kind": "PIPELINE",
              "PipelineConfig": Object {
                "Functions": Array [
                  Object {
                    "Fn::GetAtt": Array [
                      "GraphQlFunctionConfigurationfunction1",
                      "FunctionId",
                    ],
                  },
                  Object {
                    "Fn::GetAtt": Array [
                      "GraphQlFunctionConfigurationfunction2",
                      "FunctionId",
                    ],
                  },
                ],
              },
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/Query.user.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/Query.user.response.vtl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with specific mapping templates', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compileResolver({
          kind: 'PIPELINE',
          type: 'Query',
          field: 'user',
          functions: ['function1', 'function2'],
          request: 'specific.request.tpl',
          response: 'specific.response.tpl',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "FieldName": "user",
              "Kind": "PIPELINE",
              "PipelineConfig": Object {
                "Functions": Array [
                  Object {
                    "Fn::GetAtt": Array [
                      "GraphQlFunctionConfigurationfunction1",
                      "FunctionId",
                    ],
                  },
                  Object {
                    "Fn::GetAtt": Array [
                      "GraphQlFunctionConfigurationfunction2",
                      "FunctionId",
                    ],
                  },
                ],
              },
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/specific.request.tpl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/specific.response.tpl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });
  });

  describe('Pipeline Function', () => {
    it('should generate Pipeline Function Resources with default mapping templates', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compilePipelineFunctionResource({
          name: 'function1',
          dataSource: 'myTable',
          description: 'Function1 Pipeline Resolver',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlFunctionConfigurationfunction1": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
              "Description": "Function1 Pipeline Resolver",
              "FunctionVersion": "2018-05-29",
              "Name": "function1",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/function1.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/function1.response.vtl",
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
    });

    it('should generate Pipeline Function Resources with specific mapping tempaltes', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compilePipelineFunctionResource({
          name: 'function1',
          dataSource: 'myTable',
          description: 'Function1 Pipeline Resolver',
          request: 'specific.request.tpl',
          response: 'specific.response.tpl',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlFunctionConfigurationfunction1": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
              "Description": "Function1 Pipeline Resolver",
              "FunctionVersion": "2018-05-29",
              "Name": "function1",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/specific.request.tpl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/specific.response.tpl",
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
    });

    it('should generate Pipeline Function Resources with direct Lambda mapping tempaltes', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(
        api.compilePipelineFunctionResource({
          name: 'function1',
          dataSource: 'myLambdaFunction',
          description: 'Function1 Pipeline Resolver',
          request: false,
          response: false,
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlFunctionConfigurationfunction1": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyLambdaFunction",
                  "Name",
                ],
              },
              "Description": "Function1 Pipeline Resolver",
              "FunctionVersion": "2018-05-29",
              "Name": "function1",
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
    });
  });

  describe('Caching', () => {
    it('should generate Resources with caching enabled', () => {
      const api = new Api(
        given.appSyncConfig({
          caching: {
            behavior: 'PER_RESOLVER_CACHING',
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          dataSource: 'myTable',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          caching: true,
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "CachingConfig": Object {
                "Ttl": 3600,
              },
              "DataSourceName": "myTable",
              "FieldName": "user",
              "Kind": "UNIT",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/Query.user.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/Query.user.response.vtl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with custom keys', () => {
      const api = new Api(
        given.appSyncConfig({
          caching: {
            behavior: 'PER_RESOLVER_CACHING',
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          dataSource: 'myTable',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          caching: {
            ttl: 200,
            keys: ['$context.identity.sub', '$context.arguments.id'],
          },
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlResolverQueryuser": Object {
            "DependsOn": Array [
              "GraphQlSchema",
            ],
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "CachingConfig": Object {
                "CachingKeys": Array [
                  "$context.identity.sub",
                  "$context.arguments.id",
                ],
                "Ttl": 200,
              },
              "DataSourceName": "myTable",
              "FieldName": "user",
              "Kind": "UNIT",
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/Query.user.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/Query.user.response.vtl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });
  });
});
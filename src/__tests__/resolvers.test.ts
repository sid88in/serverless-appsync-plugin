import fs from 'fs';
import { Api } from '../resources/Api';
import * as given from './given';

const plugin = given.plugin();

describe('Resolvers', () => {
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

  describe('Unit Resolvers', () => {
    it('should generate Resources with default mapping templates', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
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
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
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
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
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
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
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
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myLambdaFunction: {
              name: 'myLambdaFunction',
              type: 'AWS_LAMBDA',
              config: { functionArn: 'arn:lambda:' },
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          dataSource: 'myLambdaFunction',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          request: false,
          response: false,
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
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyLambdaFunction",
                  "Name",
                ],
              },
              "FieldName": "user",
              "Kind": "UNIT",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with sync configuration', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myLambdaFunction: {
              name: 'myLambdaFunction',
              type: 'AWS_LAMBDA',
              config: { functionArn: 'arn:lambda:' },
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          dataSource: 'myLambdaFunction',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          sync: {
            conflictDetection: 'VERSION',
            conflictHandler: 'LAMBDA',
            function: {
              handler: 'index.handler',
            },
          },
        }),
      ).toMatchSnapshot();
      expect(api.functions).toMatchSnapshot();
    });

    it('should fail when referencing unknown data source', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {},
        }),
        plugin,
      );
      expect(function () {
        api.compileResolver({
          dataSource: 'myLambdaFunction',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
        });
      }).toThrowErrorMatchingInlineSnapshot(
        `"Resolver 'Query.user' references unknown DataSource 'myLambdaFunction'"`,
      );
    });
  });

  describe('Pipeline Resovlers', () => {
    it('should generate Resources with default mapping templates', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
          },
          pipelineFunctions: {
            function1: {
              name: 'function1',
              dataSource: 'myTable',
            },
            function2: {
              name: 'function2',
              dataSource: 'myTable',
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          kind: 'PIPELINE',
          type: 'Query',
          field: 'user',
          functions: ['function1', 'function2'],
        }),
      ).toMatchSnapshot();
    });

    it('should generate Resources with specific mapping templates', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
          },
          pipelineFunctions: {
            function1: {
              name: 'function1',
              dataSource: 'myTable',
            },
            function2: {
              name: 'function2',
              dataSource: 'myTable',
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          kind: 'PIPELINE',
          type: 'Query',
          field: 'user',
          functions: ['function1', 'function2'],
          request: 'specific.request.tpl',
          response: 'specific.response.tpl',
        }),
      ).toMatchSnapshot();
    });

    it('should fail when referencing unknown pipeline function', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
          },
          pipelineFunctions: {
            function1: {
              name: 'function1',
              dataSource: 'myTable',
            },
          },
        }),
        plugin,
      );
      expect(function () {
        api.compileResolver({
          kind: 'PIPELINE',
          type: 'Query',
          field: 'user',
          functions: ['function1', 'function2'],
        });
      }).toThrowErrorMatchingInlineSnapshot(
        `"Resolver 'Query.user' references unknown Pipeline function 'function2'"`,
      );
    });
  });

  describe('Pipeline Function', () => {
    it('should generate Pipeline Function Resources with default mapping templates', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
          },
        }),
        plugin,
      );
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
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
          },
        }),
        plugin,
      );
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
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myLambdaFunction: {
              name: 'myLambdaFunction',
              type: 'AWS_LAMBDA',
              config: { functionArn: 'arn:lambda:' },
            },
          },
        }),
        plugin,
      );
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

    it('should fail if Pipeline Function references unexisting data source', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {},
        }),
        plugin,
      );
      expect(function () {
        api.compilePipelineFunctionResource({
          name: 'function1',
          dataSource: 'myLambdaFunction',
          description: 'Function1 Pipeline Resolver',
          request: false,
          response: false,
        });
      }).toThrowErrorMatchingInlineSnapshot(
        `"Pipeline Function 'function1' references unknown DataSource 'myLambdaFunction'"`,
      );
    });
  });

  describe('Caching', () => {
    it('should generate Resources with caching enabled', () => {
      const api = new Api(
        given.appSyncConfig({
          caching: {
            behavior: 'PER_RESOLVER_CACHING',
          },
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
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
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
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
          dataSources: {
            myTable: {
              name: 'myTable',
              type: 'AMAZON_DYNAMODB',
              config: { tableName: 'data' },
            },
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
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
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

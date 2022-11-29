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
    it('should generate JS Resources with default empty resolver', () => {
      mockEists.mockReturnValue(false);
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
            getUser: {
              name: 'getUser',
              dataSource: 'myTable',
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          type: 'Query',
          field: 'user',
          functions: ['getUser'],
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
              "Code": "
        export function request() {
          return {};
        }

        export function response(ctx) {
          return ctx.prev.result;
        }
        ",
              "FieldName": "user",
              "Kind": "PIPELINE",
              "PipelineConfig": Object {
                "Functions": Array [
                  Object {
                    "Fn::GetAtt": Array [
                      "GraphQlFunctionConfigurationgetUser",
                      "FunctionId",
                    ],
                  },
                ],
              },
              "Runtime": Object {
                "Name": "APPSYNC_JS",
                "RuntimeVersion": "1.0.0",
              },
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with maxBatchSize', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myFunction: {
              name: 'myFunction',
              type: 'AWS_LAMBDA',
              config: { functionName: 'myFunction' },
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          dataSource: 'myFunction',
          kind: 'UNIT',
          type: 'Query',
          field: 'user',
          maxBatchSize: 200,
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
                  "GraphQlDsmyFunction",
                  "Name",
                ],
              },
              "FieldName": "user",
              "Kind": "UNIT",
              "MaxBatchSize": 200,
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate Resources with VTL mapping templates', () => {
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
          request: 'Query.user.request.tpl',
          response: 'Query.user.response.tpl',
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
              "MaxBatchSize": undefined,
              "RequestMappingTemplate": "Content of Query.user.request.tpl",
              "ResponseMappingTemplate": "Content of Query.user.response.tpl",
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });

    it('should generate JS Resources with specific code', () => {
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
            getUser: {
              name: 'getUser',
              dataSource: 'myTable',
            },
          },
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          type: 'Query',
          field: 'user',
          functions: ['getUser'],
          code: 'resolvers/getUserFunction.js',
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
              "Code": "Content of resolvers/getUserFunction.js",
              "FieldName": "user",
              "Kind": "PIPELINE",
              "PipelineConfig": Object {
                "Functions": Array [
                  Object {
                    "Fn::GetAtt": Array [
                      "GraphQlFunctionConfigurationgetUser",
                      "FunctionId",
                    ],
                  },
                ],
              },
              "Runtime": Object {
                "Name": "APPSYNC_JS",
                "RuntimeVersion": "1.0.0",
              },
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
              "MaxBatchSize": undefined,
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
    it('should generate Resources with VTL mapping templates', () => {
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
          request: 'Query.user.request.vtl',
          response: 'Query.user.response.vtl',
          functions: ['function1', 'function2'],
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
        api.compilePipelineFunctionResource({
          dataSource: 'myLambdaFunction',
          name: 'myFunction',
          request: 'myFunction.request.vtl',
          response: 'myFunction.response.vtl',
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

    it('should generate Pipeline Function Resources with maxBatchSize', () => {
      const api = new Api(
        given.appSyncConfig({
          dataSources: {
            myFunction: {
              name: 'myFunction',
              type: 'AWS_LAMBDA',
              config: { functionName: 'myFunction' },
            },
          },
        }),
        plugin,
      );
      expect(
        api.compilePipelineFunctionResource({
          name: 'function1',
          dataSource: 'myFunction',
          request: 'function1.request.vtl',
          response: 'function1.response.vtl',
          description: 'Function1 Pipeline Resolver',
          maxBatchSize: 200,
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
                  "GraphQlDsmyFunction",
                  "Name",
                ],
              },
              "Description": "Function1 Pipeline Resolver",
              "FunctionVersion": "2018-05-29",
              "MaxBatchSize": 200,
              "Name": "function1",
              "RequestMappingTemplate": "Content of function1.request.vtl",
              "ResponseMappingTemplate": "Content of function1.response.vtl",
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
    });

    it('should generate Pipeline Function Resources with JS code', () => {
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
          code: 'funciton1.js',
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
              "Code": "Content of funciton1.js",
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
              "Description": "Function1 Pipeline Resolver",
              "FunctionVersion": "2018-05-29",
              "MaxBatchSize": undefined,
              "Name": "function1",
              "Runtime": Object {
                "Name": "APPSYNC_JS",
                "RuntimeVersion": "1.0.0",
              },
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
    });

    it('should generate Pipeline Function Resources with VTL mapping tempaltes', () => {
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
          request: 'function1.request.tpl',
          response: 'function1.response.tpl',
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
              "MaxBatchSize": undefined,
              "Name": "function1",
              "RequestMappingTemplate": "Content of function1.request.tpl",
              "ResponseMappingTemplate": "Content of function1.response.tpl",
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
              "MaxBatchSize": undefined,
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
              "MaxBatchSize": undefined,
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
              "MaxBatchSize": undefined,
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
    });
  });
});

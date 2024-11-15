import * as esbuild from 'esbuild';
import fs from 'fs';
import { Api } from '../resources/Api';
import * as given from './given';

const plugin = given.plugin();

jest.mock('esbuild', () => ({
  buildSync: jest.fn().mockImplementation((config) => {
    return {
      errors: [],
      warnings: [],
      metafile: undefined,
      mangleCache: undefined,
      outputFiles: [
        {
          path: 'path/to/file',
          contents: Uint8Array.from([]),
          text: `Bundled content of ${`${config.entryPoints?.[0]}`.replace(
            /\\/g,
            '/',
          )}`,
        },
      ],
    };
  }),
}));

describe('Resolvers', () => {
  let mock: jest.SpyInstance;
  let mockExists: jest.SpyInstance;
  let mockEsbuild: jest.SpyInstance;
  beforeEach(() => {
    mock = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(
        (path) => `Content of ${`${path}`.replace(/\\/g, '/')}`,
      );
    mockExists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    mockEsbuild = jest
      .spyOn(esbuild, 'buildSync')
      .mockImplementation((config) => {
        return {
          errors: [],
          warnings: [],
          metafile: undefined,
          mangleCache: undefined,
          outputFiles: [
            {
              path: 'path/to/file',
              contents: Uint8Array.from([]),
              text: `Bundled content of ${`${config.entryPoints?.[0]}`.replace(
                /\\/g,
                '/',
              )}`,
            },
          ],
        };
      });
  });

  afterEach(() => {
    mock.mockRestore();
    mockExists.mockRestore();
    mockEsbuild.mockRestore();
  });

  describe('esbuild', () => {
    it('should skip esbuild when disabled', () => {
      const api = new Api(
        given.appSyncConfig({
          esbuild: false,
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
          dataSource: 'myTable',
          code: 'path/to/my-resolver.js',
          name: 'my-function',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlFunctionConfigurationmyfunction": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Code": "Content of path/to/my-resolver.js",
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
              "Description": undefined,
              "FunctionVersion": "2018-05-29",
              "MaxBatchSize": undefined,
              "Name": "my-function",
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
  });

  describe('Unit Resolvers', () => {
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
          request: 'path/to/mappingTemplates/Query.user.request.vtl',
          response: 'path/to/mappingTemplates/Query.user.response.vtl',
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
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/Query.user.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/Query.user.response.vtl",
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
        }),
        plugin,
      );
      expect(
        api.compileResolver({
          type: 'Query',
          kind: 'UNIT',
          field: 'user',
          dataSource: 'myTable',
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
              "Code": "Bundled content of resolvers/getUserFunction.js",
              "DataSourceName": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyTable",
                  "Name",
                ],
              },
              "FieldName": "user",
              "Kind": "UNIT",
              "MaxBatchSize": undefined,
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

    it('should generate Resources with direct Lambda', () => {
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
              "SyncConfig": Object {
                "ConflictDetection": "VERSION",
                "ConflictHandler": "LAMBDA",
                "LambdaConflictHandlerConfig": Object {
                  "LambdaConflictHandlerArn": Object {
                    "Fn::GetAtt": Array [
                      "QueryUnderscoreuserUnderscoreSyncLambdaFunction",
                      "Arn",
                    ],
                  },
                },
              },
              "TypeName": "Query",
            },
            "Type": "AWS::AppSync::Resolver",
          },
        }
      `);
      expect(api.functions).toMatchInlineSnapshot(`
        Object {
          "Query_user_Sync": Object {
            "handler": "index.handler",
          },
        }
      `);
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
    it('should generate JS Resources with default empty resolver', () => {
      mockExists.mockReturnValue(false);
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
              "RequestMappingTemplate": "Content of Query.user.request.vtl",
              "ResponseMappingTemplate": "Content of Query.user.response.vtl",
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
              "Code": "Bundled content of resolvers/getUserFunction.js",
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
              "Code": "Bundled content of funciton1.js",
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
          request: 'path/to/mappingTemplates/function1.request.vtl',
          response: 'path/to/mappingTemplates/function1.response.vtl',
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
              "RequestMappingTemplate": "Content of path/to/mappingTemplates/function1.request.vtl",
              "ResponseMappingTemplate": "Content of path/to/mappingTemplates/function1.response.vtl",
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
    });

    it('should generate Pipeline Function Resources with direct Lambda', () => {
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
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlFunctionConfigurationmyFunction": Object {
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
              "Description": undefined,
              "FunctionVersion": "2018-05-29",
              "MaxBatchSize": undefined,
              "Name": "myFunction",
              "RequestMappingTemplate": "Content of myFunction.request.vtl",
              "ResponseMappingTemplate": "Content of myFunction.response.vtl",
              "SyncConfig": Object {
                "ConflictDetection": "VERSION",
                "ConflictHandler": "LAMBDA",
                "LambdaConflictHandlerConfig": Object {
                  "LambdaConflictHandlerArn": Object {
                    "Fn::GetAtt": Array [
                      "MyFunctionUnderscoreSyncLambdaFunction",
                      "Arn",
                    ],
                  },
                },
              },
            },
            "Type": "AWS::AppSync::FunctionConfiguration",
          },
        }
      `);
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

    it('should fallback to global caching TTL', () => {
      const api = new Api(
        given.appSyncConfig({
          caching: {
            behavior: 'PER_RESOLVER_CACHING',
            ttl: 300,
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
                "Ttl": 300,
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

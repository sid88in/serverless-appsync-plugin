import fs from 'fs';
import { Api } from '../resources/Api';
import { AppSyncConfig } from '../types/plugin';
import Serverless from 'serverless/lib/Serverless';
import { noop, set } from 'lodash';
import { logger } from '../utils';
import AwsProvider from 'serverless/lib/plugins/aws/provider.js';
import ServerlessAppsyncPlugin from '..';

// 2020-12-09T16:24:22+00:00
jest.spyOn(Date, 'now').mockImplementation(() => 1607531062000);

const config: AppSyncConfig = {
  name: 'MyApi',
  isSingleConfig: true,
  region: 'us-east-1',
  xrayEnabled: false,
  schema: 'type Query { }',
  authentication: {
    type: 'API_KEY',
  },
  additionalAuthenticationProviders: [],
  mappingTemplatesLocation: {
    resolvers: 'path/to/mappingTemplates',
    pipelineFunctions: 'path/to/mappingTemplates',
  },
  resolvers: [],
  pipelineFunctions: [],
  dataSources: [],
  substitutions: {},
  tags: {
    stage: 'Dev',
  },
};

const serverless = new Serverless();
serverless.setProvider('aws', new AwsProvider(serverless));
serverless.serviceOutputs = new Map();
serverless.servicePluginOutputs = new Map();
set(serverless, 'configurationInput.custom.appSync', []);

const options = {
  stage: 'dev',
  region: 'us-east-1',
};
const plugin = new ServerlessAppsyncPlugin(serverless, options, {
  log: logger(noop),
  writeText: noop,
});

describe('Api', () => {
  describe('compileEndpoint', () => {
    it('should compile the Api Resoruce', () => {
      const api = new Api(config, plugin);
      expect(api.compileEndpoint()).toMatchInlineSnapshot(`
        Object {
          "GraphQlApi": Object {
            "Properties": Object {
              "AuthenticationType": "API_KEY",
              "Name": "MyApi",
              "Tags": Array [
                Object {
                  "Key": "stage",
                  "Value": "Dev",
                },
              ],
              "XrayEnabled": false,
            },
            "Type": "AWS::AppSync::GraphQLApi",
          },
        }
      `);
    });

    it('should compile the Api Resoruce with logs enabled', () => {
      const api = new Api(
        {
          ...config,
          logConfig: {
            level: 'ERROR',
            excludeVerboseContent: false,
            logRetentionInDays: 14,
          },
        },
        plugin,
      );
      expect(api.compileEndpoint()).toMatchInlineSnapshot(`
        Object {
          "GraphQlApi": Object {
            "Properties": Object {
              "AuthenticationType": "API_KEY",
              "LogConfig": Object {
                "CloudWatchLogsRoleArn": Object {
                  "Fn::GetAtt": Array [
                    "GraphQlApiLogGroupRole",
                    "Arn",
                  ],
                },
                "ExcludeVerboseContent": false,
                "FieldLogLevel": "ERROR",
              },
              "Name": "MyApi",
              "Tags": Array [
                Object {
                  "Key": "stage",
                  "Value": "Dev",
                },
              ],
              "XrayEnabled": false,
            },
            "Type": "AWS::AppSync::GraphQLApi",
          },
        }
      `);
    });

    it('should compile the Api Resoruce with additional auths', () => {
      const api = new Api(
        {
          ...config,
          additionalAuthenticationProviders: [
            {
              type: 'AMAZON_COGNITO_USER_POOLS',
              config: {
                userPoolId: 'pool123',
                awsRegion: 'us-east-1',
                appIdClientRegex: '[a-z]',
              },
            },
            {
              type: 'AWS_IAM',
            },
            {
              type: 'OPENID_CONNECT',
              config: {
                issuer: 'https://auth.example.com',
                clientId: '333746dd-06fc-44df-bce2-5ff108724044',
                iatTTL: 3600,
                authTTL: 60,
              },
            },
            {
              type: 'AWS_LAMBDA',
              config: {
                functionName: 'authFunction',
                identityValidationExpression: 'customm-*',
                authorizerResultTtlInSeconds: 300,
              },
            },
          ],
        },
        plugin,
      );
      expect(api.compileEndpoint()).toMatchInlineSnapshot(`
        Object {
          "GraphQlApi": Object {
            "Properties": Object {
              "AdditionalAuthenticationProviders": Array [
                Object {
                  "AuthenticationType": "AMAZON_COGNITO_USER_POOLS",
                  "UserPoolConfig": Object {
                    "AppIdClientRegex": "[a-z]",
                    "AwsRegion": "us-east-1",
                    "DefaultAction": "DENY",
                    "UserPoolId": "pool123",
                  },
                },
                Object {
                  "AuthenticationType": "AWS_IAM",
                },
                Object {
                  "AuthenticationType": "OPENID_CONNECT",
                  "OpenIDConnectConfig": Object {
                    "AuthTTL": 60,
                    "ClientId": "333746dd-06fc-44df-bce2-5ff108724044",
                    "IatTTL": 3600,
                    "Issuer": "https://auth.example.com",
                  },
                },
                Object {
                  "AuthenticationType": "AWS_LAMBDA",
                  "LambdaAuthorizerConfig": Object {
                    "AuthorizerResultTtlInSeconds": 300,
                    "AuthorizerUri": Object {
                      "Fn::GetAtt": Array [
                        "AuthFunctionLambdaFunction",
                        "Arn",
                      ],
                    },
                    "IdentityValidationExpression": "customm-*",
                  },
                },
              ],
              "AuthenticationType": "API_KEY",
              "Name": "MyApi",
              "Tags": Array [
                Object {
                  "Key": "stage",
                  "Value": "Dev",
                },
              ],
              "XrayEnabled": false,
            },
            "Type": "AWS::AppSync::GraphQLApi",
          },
        }
      `);
    });
  });

  it('should use defaultAction as ALLOW for Cognito when primary auth and additionalAuth are present', () => {
    const api = new Api(
      {
        ...config,
        authentication: {
          type: 'AMAZON_COGNITO_USER_POOLS',
          config: {
            userPoolId: 'pool123',
            awsRegion: 'us-east-1',
            appIdClientRegex: '[a-z]',
          },
        },
        additionalAuthenticationProviders: [
          {
            type: 'AWS_IAM',
          },
        ],
      },
      plugin,
    );
    expect(api.compileEndpoint()).toMatchInlineSnapshot(`
      Object {
        "GraphQlApi": Object {
          "Properties": Object {
            "AdditionalAuthenticationProviders": Array [
              Object {
                "AuthenticationType": "AWS_IAM",
              },
            ],
            "AuthenticationType": "AMAZON_COGNITO_USER_POOLS",
            "Name": "MyApi",
            "Tags": Array [
              Object {
                "Key": "stage",
                "Value": "Dev",
              },
            ],
            "UserPoolConfig": Object {
              "AppIdClientRegex": "[a-z]",
              "AwsRegion": "us-east-1",
              "DefaultAction": "ALLOW",
              "UserPoolId": "pool123",
            },
            "XrayEnabled": false,
          },
          "Type": "AWS::AppSync::GraphQLApi",
        },
      }
    `);
  });

  it('should use defaultAction as DENY for Cognito when primary auth and additionalAuth are not present', () => {
    const api = new Api(
      {
        ...config,
        authentication: {
          type: 'AMAZON_COGNITO_USER_POOLS',
          config: {
            userPoolId: 'pool123',
            awsRegion: 'us-east-1',
            appIdClientRegex: '[a-z]',
          },
        },
        additionalAuthenticationProviders: [],
      },
      plugin,
    );
    expect(api.compileEndpoint()).toMatchInlineSnapshot(`
      Object {
        "GraphQlApi": Object {
          "Properties": Object {
            "AuthenticationType": "AMAZON_COGNITO_USER_POOLS",
            "Name": "MyApi",
            "Tags": Array [
              Object {
                "Key": "stage",
                "Value": "Dev",
              },
            ],
            "UserPoolConfig": Object {
              "AppIdClientRegex": "[a-z]",
              "AwsRegion": "us-east-1",
              "DefaultAction": "DENY",
              "UserPoolId": "pool123",
            },
            "XrayEnabled": false,
          },
          "Type": "AWS::AppSync::GraphQLApi",
        },
      }
    `);
  });

  it('should use defaultAction as DENY for Cognito when not primary auth', () => {
    const api = new Api(
      {
        ...config,
        authentication: {
          type: 'API_KEY',
        },
        additionalAuthenticationProviders: [
          {
            type: 'AMAZON_COGNITO_USER_POOLS',
            config: {
              userPoolId: 'pool123',
              awsRegion: 'us-east-1',
              appIdClientRegex: '[a-z]',
            },
          },
        ],
      },
      plugin,
    );
    expect(api.compileEndpoint()).toMatchInlineSnapshot(`
      Object {
        "GraphQlApi": Object {
          "Properties": Object {
            "AdditionalAuthenticationProviders": Array [
              Object {
                "AuthenticationType": "AMAZON_COGNITO_USER_POOLS",
                "UserPoolConfig": Object {
                  "AppIdClientRegex": "[a-z]",
                  "AwsRegion": "us-east-1",
                  "DefaultAction": "DENY",
                  "UserPoolId": "pool123",
                },
              },
            ],
            "AuthenticationType": "API_KEY",
            "Name": "MyApi",
            "Tags": Array [
              Object {
                "Key": "stage",
                "Value": "Dev",
              },
            ],
            "XrayEnabled": false,
          },
          "Type": "AWS::AppSync::GraphQLApi",
        },
      }
    `);
  });

  describe('schema', () => {
    it('should compile the schema resource', () => {
      const api = new Api(config, plugin);
      expect(api.compileSchema()).toMatchInlineSnapshot(`
        Object {
          "GraphQlSchema": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Definition": "type Query { }",
            },
            "Type": "AWS::AppSync::GraphQLSchema",
          },
        }
      `);
    });
  });

  describe('CloudWatch', () => {
    it('should not compile CloudWatch Resources when disabled', () => {
      const api = new Api(config, plugin);
      expect(api.compileCloudWatchLogGroup()).toMatchInlineSnapshot(
        `Object {}`,
      );
    });

    it('should compile CloudWatch Resources when enaabled', () => {
      const api = new Api(
        {
          ...config,
          logConfig: {
            level: 'ERROR',
            logRetentionInDays: 14,
          },
        },
        plugin,
      );
      expect(api.compileCloudWatchLogGroup()).toMatchInlineSnapshot(`
        Object {
          "GraphQlApiLogGroup": Object {
            "Properties": Object {
              "LogGroupName": Object {
                "Fn::Join": Array [
                  "/",
                  Array [
                    "/aws/appsync/apis",
                    Object {
                      "Fn::GetAtt": Array [
                        "GraphQlApi",
                        "ApiId",
                      ],
                    },
                  ],
                ],
              },
              "RetentionInDays": 14,
            },
            "Type": "AWS::Logs::LogGroup",
          },
          "GraphQlApiLogGroupRole": Object {
            "Properties": Object {
              "AssumeRolePolicyDocument": Object {
                "Statement": Array [
                  Object {
                    "Action": Array [
                      "sts:AssumeRole",
                    ],
                    "Effect": "Allow",
                    "Principal": Object {
                      "Service": Array [
                        "appsync.amazonaws.com",
                      ],
                    },
                  },
                ],
                "Version": "2012-10-17",
              },
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });
  });

  describe('apiKeys', () => {
    const api = new Api(
      {
        ...config,
        apiKeys: [
          {
            name: 'Default',
            description: 'Default Key',
            expiresAfter: '30d',
          },
          {
            name: 'Key1',
            description: 'Key1',
            expiresAfter: '1d',
          },
          {
            name: 'Key2',
            description: 'Key2',
            apiKeyId: 'da2-7hfy4mjkdmh64lp0une7yht765',
          },
          {
            name: 'John',
            description: "John's key",
            expiresAt: '2021-03-09T16:00:00+00:00',
          },
          {
            name: 'Jane',
            expiresAfter: '1y',
          },
          'InlineKey',
        ],
      },
      plugin,
    );
    it('should generate api keys', () => {
      const apiKeys = api.getApiKeys();
      expect(apiKeys).toMatchInlineSnapshot(`
        Array [
          Object {
            "description": "Default Key",
            "expiresAfter": "30d",
            "name": "Default",
          },
          Object {
            "description": "Key1",
            "expiresAfter": "1d",
            "name": "Key1",
          },
          Object {
            "apiKeyId": "da2-7hfy4mjkdmh64lp0une7yht765",
            "description": "Key2",
            "name": "Key2",
          },
          Object {
            "description": "John's key",
            "expiresAt": "2021-03-09T16:00:00+00:00",
            "name": "John",
          },
          Object {
            "expiresAfter": "1y",
            "name": "Jane",
          },
          Object {
            "name": "InlineKey",
          },
        ]
      `);
    });

    it('should generate an api key with sliding window expiration', () => {
      expect(
        api.compileApiKey({
          name: 'Default',
          description: 'Default Key',
          expiresAfter: '30d',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlApiDefault": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "ApiKeyId": undefined,
              "Description": "Default Key",
              "Expires": 1610121600,
            },
            "Type": "AWS::AppSync::ApiKey",
          },
        }
      `);
    });

    it('should generate an api key with explicit expiresAt', () => {
      expect(
        api.compileApiKey({
          name: 'Default',
          description: 'Default Key',
          expiresAt: '2022-12-31T22:00:00+00:00',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlApiDefault": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "ApiKeyId": undefined,
              "Description": "Default Key",
              "Expires": 1672524000,
            },
            "Type": "AWS::AppSync::ApiKey",
          },
        }
      `);
    });

    it('should generate an api key with default expiry', () => {
      expect(
        api.compileApiKey({
          name: 'Default',
          description: 'Default Key',
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "GraphQlApiDefault": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "ApiKeyId": undefined,
              "Description": "Default Key",
              "Expires": 1639065600,
            },
            "Type": "AWS::AppSync::ApiKey",
          },
        }
      `);
    });
  });

  describe('LambdaAuthorizer', () => {
    it('should not generate the Lambda Authorizer Resoruces', () => {
      const api = new Api(
        {
          ...config,
          authentication: {
            type: 'API_KEY',
          },
        },
        plugin,
      );
      expect(api.compileLambdaAuthorizerPermission()).toMatchInlineSnapshot(
        `Object {}`,
      );
    });

    it('should generate the Lambda Authorizer Resoruces from basic auth', () => {
      const api = new Api(
        {
          ...config,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionArn: 'arn:',
            },
          },
        },
        plugin,
      );
      expect(api.compileLambdaAuthorizerPermission()).toMatchInlineSnapshot(`
        Object {
          "LambdaAuthorizerPermission": Object {
            "Properties": Object {
              "Action": "lambda:InvokeFunction",
              "FunctionName": "arn:",
              "Principal": "appsync.amazonaws.com",
              "SourceArn": Object {
                "Ref": "GraphQlApi",
              },
            },
            "Type": "AWS::Lambda::Permission",
          },
        }
      `);
    });

    it('should generate the Lambda Authorizer Resources from additional auth', () => {
      const api = new Api(
        {
          ...config,
          additionalAuthenticationProviders: [
            {
              type: 'AWS_LAMBDA',
              config: {
                functionArn: 'arn:',
              },
            },
          ],
        },
        plugin,
      );
      expect(api.compileLambdaAuthorizerPermission()).toMatchInlineSnapshot(`
        Object {
          "LambdaAuthorizerPermission": Object {
            "Properties": Object {
              "Action": "lambda:InvokeFunction",
              "FunctionName": "arn:",
              "Principal": "appsync.amazonaws.com",
              "SourceArn": Object {
                "Ref": "GraphQlApi",
              },
            },
            "Type": "AWS::Lambda::Permission",
          },
        }
      `);
    });
  });

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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
        const api = new Api(config, plugin);
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
          {
            ...config,
            caching: {
              behavior: 'PER_RESOLVER_CACHING',
            },
          },
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
          {
            ...config,
            caching: {
              behavior: 'PER_RESOLVER_CACHING',
            },
          },
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
});

describe('Caching', () => {
  it('should not generate Resources when disabled', () => {
    const api = new Api({ ...config, caching: undefined }, plugin);
    expect(api.compileCachingResources()).toEqual({});
  });

  it('should generate Resources with defaults', () => {
    const api = new Api(
      {
        ...config,
        caching: {
          behavior: 'FULL_REQUEST_CACHING',
        },
      },
      plugin,
    );
    expect(api.compileCachingResources()).toMatchInlineSnapshot(`
        Object {
          "GraphQlCaching": Object {
            "Properties": Object {
              "ApiCachingBehavior": "FULL_REQUEST_CACHING",
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "AtRestEncryptionEnabled": false,
              "TransitEncryptionEnabled": false,
              "Ttl": 3600,
              "Type": "T2_SMALL",
            },
            "Type": "AWS::AppSync::ApiCache",
          },
        }
      `);
  });

  it('should generate Resources with custom Config', () => {
    const api = new Api(
      {
        ...config,
        caching: {
          behavior: 'FULL_REQUEST_CACHING',
          atRestEncryption: true,
          transitEncryption: true,
          ttl: 500,
          type: 'T2_MEDIUM',
        },
      },
      plugin,
    );
    expect(api.compileCachingResources()).toMatchInlineSnapshot(`
        Object {
          "GraphQlCaching": Object {
            "Properties": Object {
              "ApiCachingBehavior": "FULL_REQUEST_CACHING",
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "AtRestEncryptionEnabled": true,
              "TransitEncryptionEnabled": true,
              "Ttl": 500,
              "Type": "T2_MEDIUM",
            },
            "Type": "AWS::AppSync::ApiCache",
          },
        }
      `);
  });
});

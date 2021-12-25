import fs from 'fs';
import { Api } from '../resources/Api';
import { flatten, upperFirst } from 'lodash';
import globby from 'globby';
import * as given from './given';

// 2020-12-09T16:24:22+00:00
jest.spyOn(Date, 'now').mockImplementation(() => 1607531062000);

const plugin = given.plugin();

describe('Api', () => {
  describe('compileEndpoint', () => {
    it('should compile the Api Resource', () => {
      const api = new Api(given.appSyncConfig(), plugin);
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

    it('should compile the Api Resource with logs enabled', () => {
      const api = new Api(
        given.appSyncConfig({
          logConfig: {
            level: 'ERROR',
            excludeVerboseContent: false,
            logRetentionInDays: 14,
          },
        }),
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

    it('should compile the Api Resource with additional auths', () => {
      const api = new Api(
        given.appSyncConfig({
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
        }),
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

    it('should compile the Api Resource with embedded authorizer Lambda function', () => {
      const api = new Api(
        given.appSyncConfig({
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              function: {
                handler: 'index.handler',
              },
            },
          },
        }),
        plugin,
      );
      expect(api.compileEndpoint()).toMatchSnapshot();
      expect(api.functions).toMatchSnapshot();
    });

    it('should compile the Api Resource with embedded additional authorizer Lambda function', () => {
      const api = new Api(
        given.appSyncConfig({
          additionalAuthenticationProviders: [
            {
              type: 'AWS_LAMBDA',
              config: {
                function: {
                  handler: 'index.handler',
                },
              },
            },
          ],
        }),
        plugin,
      );
      expect(api.compileEndpoint()).toMatchSnapshot();
      expect(api.functions).toMatchSnapshot();
    });
  });

  it('should use defaultAction as ALLOW for Cognito when primary auth and additionalAuth are present', () => {
    const api = new Api(
      given.appSyncConfig({
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
      }),
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
      given.appSyncConfig({
        authentication: {
          type: 'AMAZON_COGNITO_USER_POOLS',
          config: {
            userPoolId: 'pool123',
            awsRegion: 'us-east-1',
            appIdClientRegex: '[a-z]',
          },
        },
        additionalAuthenticationProviders: [],
      }),
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
      given.appSyncConfig({
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
      }),
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
    let mock: jest.SpyInstance;
    let globbyMock: jest.SpyInstance;
    beforeAll(() => {
      mock = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
        const matches = `${path}`.match(/([a-z]+)\.graphql$/);
        const type = upperFirst(matches?.[1] || 'Unknown');
        return `
            type Query {
              get${type}: ${type}!
            }

            type ${type} {
              id: ID!
            }
          `;
      });

      globbyMock = jest.spyOn(globby, 'sync').mockImplementation((globPath) => {
        const genGlob = (glob: string) => [
          glob.replace('*', 'users'),
          glob.replace('*', 'posts'),
        ];
        if (typeof globPath === 'string') {
          return genGlob(globPath);
        } else {
          return flatten(globPath.map(genGlob));
        }
      });
    });

    afterAll(() => {
      mock.mockRestore();
      globbyMock.mockRestore();
    });

    it('should merge the schemas', () => {
      const api = new Api(
        given.appSyncConfig({ schema: ['users.graphql', 'posts.graphql'] }),
        plugin,
      );
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
              "Definition": "type Query  {
          getUsers: Users!
          getPosts: Posts!
        }

        type Users  {
          id: ID!
        }

        type Posts  {
          id: ID!
        }",
            },
            "Type": "AWS::AppSync::GraphQLSchema",
          },
        }
      `);
    });

    it('should merge glob schemas', () => {
      const api = new Api(
        given.appSyncConfig({ schema: ['*.graphql'] }),
        plugin,
      );
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
              "Definition": "type Query  {
          getUsers: Users!
          getPosts: Posts!
        }

        type Users  {
          id: ID!
        }

        type Posts  {
          id: ID!
        }",
            },
            "Type": "AWS::AppSync::GraphQLSchema",
          },
        }
      `);
    });
  });

  describe('CloudWatch', () => {
    it('should not compile CloudWatch Resources when disabled', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      expect(api.compileCloudWatchLogGroup()).toMatchInlineSnapshot(
        `Object {}`,
      );
    });

    it('should compile CloudWatch Resources when enaabled', () => {
      const api = new Api(
        given.appSyncConfig({
          logConfig: {
            level: 'ERROR',
            logRetentionInDays: 14,
          },
        }),
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
    const api = new Api(given.appSyncConfig(), plugin);

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
    it('should not generate the Lambda Authorizer Resources', () => {
      const api = new Api(
        given.appSyncConfig({
          authentication: {
            type: 'API_KEY',
          },
        }),
        plugin,
      );
      expect(api.compileLambdaAuthorizerPermission()).toMatchInlineSnapshot(
        `Object {}`,
      );
    });

    it('should generate the Lambda Authorizer Resources from basic auth', () => {
      const api = new Api(
        given.appSyncConfig({
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionArn: 'arn:',
            },
          },
        }),
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
        given.appSyncConfig({
          additionalAuthenticationProviders: [
            {
              type: 'AWS_LAMBDA',
              config: {
                functionArn: 'arn:',
              },
            },
          ],
        }),
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
});

describe('Caching', () => {
  it('should not generate Resources when disabled', () => {
    const api = new Api(given.appSyncConfig({ caching: undefined }), plugin);
    expect(api.compileCachingResources()).toEqual({});
  });

  it('should generate Resources with defaults', () => {
    const api = new Api(
      given.appSyncConfig({
        caching: {
          behavior: 'FULL_REQUEST_CACHING',
        },
      }),
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
      given.appSyncConfig({
        caching: {
          behavior: 'FULL_REQUEST_CACHING',
          atRestEncryption: true,
          transitEncryption: true,
          ttl: 500,
          type: 'T2_MEDIUM',
        },
      }),
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

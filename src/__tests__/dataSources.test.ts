import { Api } from '../resources/Api';
import { AppSyncConfig } from '../types/plugin';
import Serverless from 'serverless/lib/Serverless';
import { noop, set } from 'lodash';
import AwsProvider from 'serverless/lib/plugins/aws/provider.js';
import ServerlessAppsyncPlugin from '..';
import { logger } from '../utils';
import { DataSource } from '../resources/DataSource';

// 2020-12-09T16:24:22+00:00
jest.spyOn(Date, 'now').mockImplementation(() => 1607531062000);

// FIXME: put this in a helper
const config: AppSyncConfig = {
  name: 'MyApi',
  isSingleConfig: true,
  region: 'us-east-1',
  xrayEnabled: false,
  schema: 'type Query { }',
  authenticationType: 'API_KEY',
  additionalAuthenticationProviders: [],
  mappingTemplatesLocation: 'path/to/mappingTemplates',
  functionConfigurationsLocation: 'path/to/mappingTemplates',
  mappingTemplates: [],
  functionConfigurations: [],
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

describe('DataSource', () => {
  describe('DynamoDB', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsdynamo": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My dynamo table",
              "DynamoDBConfig": Object {
                "AwsRegion": Object {
                  "Ref": "AWS::Region",
                },
                "TableName": "data",
                "UseCallerCredentials": false,
              },
              "Name": "dynamo",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsdynamoRole",
                  "Arn",
                ],
              },
              "Type": "AMAZON_DYNAMODB",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsdynamoRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "dynamodb:DeleteItem",
                          "dynamodb:GetItem",
                          "dynamodb:PutItem",
                          "dynamodb:Query",
                          "dynamodb:Scan",
                          "dynamodb:UpdateItem",
                          "dynamodb:BatchGetItem",
                          "dynamodb:BatchWriteItem",
                          "dynamodb:ConditionCheckItem",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                "arn",
                                "aws",
                                "dynamodb",
                                Object {
                                  "Ref": "AWS::Region",
                                },
                                Object {
                                  "Ref": "AWS::AccountId",
                                },
                                "table/data",
                              ],
                            ],
                          },
                          Object {
                            "Fn::Join": Array [
                              "/",
                              Array [
                                Object {
                                  "Fn::Join": Array [
                                    ":",
                                    Array [
                                      "arn",
                                      "aws",
                                      "dynamodb",
                                      Object {
                                        "Ref": "AWS::Region",
                                      },
                                      Object {
                                        "Ref": "AWS::AccountId",
                                      },
                                      "table/data",
                                    ],
                                  ],
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-dynamo",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate Resource with default deltaSync', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          versioned: true,
          deltaSyncConfig: {
            deltaSyncTableName: 'syncTable',
            baseTableTTL: 60,
            deltaSyncTableTTL: 120,
          },
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsdynamo": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My dynamo table",
              "DynamoDBConfig": Object {
                "AwsRegion": Object {
                  "Ref": "AWS::Region",
                },
                "DeltaSyncConfig": Object {
                  "BaseTableTTL": 60,
                  "DeltaSyncTableName": "syncTable",
                  "DeltaSyncTableTTL": 120,
                },
                "TableName": "data",
                "UseCallerCredentials": false,
              },
              "Name": "dynamo",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsdynamoRole",
                  "Arn",
                ],
              },
              "Type": "AMAZON_DYNAMODB",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsdynamoRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "dynamodb:DeleteItem",
                          "dynamodb:GetItem",
                          "dynamodb:PutItem",
                          "dynamodb:Query",
                          "dynamodb:Scan",
                          "dynamodb:UpdateItem",
                          "dynamodb:BatchGetItem",
                          "dynamodb:BatchWriteItem",
                          "dynamodb:ConditionCheckItem",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                "arn",
                                "aws",
                                "dynamodb",
                                Object {
                                  "Ref": "AWS::Region",
                                },
                                Object {
                                  "Ref": "AWS::AccountId",
                                },
                                "table/data",
                              ],
                            ],
                          },
                          Object {
                            "Fn::Join": Array [
                              "/",
                              Array [
                                Object {
                                  "Fn::Join": Array [
                                    ":",
                                    Array [
                                      "arn",
                                      "aws",
                                      "dynamodb",
                                      Object {
                                        "Ref": "AWS::Region",
                                      },
                                      Object {
                                        "Ref": "AWS::AccountId",
                                      },
                                      "table/data",
                                    ],
                                  ],
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-dynamo",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate default role with custom region', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          region: 'us-east-2',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsdynamo": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My dynamo table",
              "DynamoDBConfig": Object {
                "AwsRegion": "us-east-2",
                "TableName": "data",
                "UseCallerCredentials": false,
              },
              "Name": "dynamo",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsdynamoRole",
                  "Arn",
                ],
              },
              "Type": "AMAZON_DYNAMODB",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsdynamoRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "dynamodb:DeleteItem",
                          "dynamodb:GetItem",
                          "dynamodb:PutItem",
                          "dynamodb:Query",
                          "dynamodb:Scan",
                          "dynamodb:UpdateItem",
                          "dynamodb:BatchGetItem",
                          "dynamodb:BatchWriteItem",
                          "dynamodb:ConditionCheckItem",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                "arn",
                                "aws",
                                "dynamodb",
                                "us-east-2",
                                Object {
                                  "Ref": "AWS::AccountId",
                                },
                                "table/data",
                              ],
                            ],
                          },
                          Object {
                            "Fn::Join": Array [
                              "/",
                              Array [
                                Object {
                                  "Fn::Join": Array [
                                    ":",
                                    Array [
                                      "arn",
                                      "aws",
                                      "dynamodb",
                                      "us-east-2",
                                      Object {
                                        "Ref": "AWS::AccountId",
                                      },
                                      "table/data",
                                    ],
                                  ],
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-dynamo",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate default role with custom statement', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['dynamodb:GetItem'],
              Resource: ['arn:aws:dynamodb:us-east-1:12345678:myTable'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsdynamoRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "dynamodb:GetItem",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          "arn:aws:dynamodb:us-east-1:12345678:myTable",
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-dynamo",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('AWS Lambda', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myFunction',
        description: 'My lambda resolver',
        config: {
          functionName: 'myFunction',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyFunction": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My lambda resolver",
              "LambdaConfig": Object {
                "LambdaFunctionArn": Object {
                  "Fn::GetAtt": Array [
                    "MyFunctionLambdaFunction",
                    "Arn",
                  ],
                },
              },
              "Name": "myFunction",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyFunctionRole",
                  "Arn",
                ],
              },
              "Type": "AWS_LAMBDA",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsmyFunctionRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "lambda:invokeFunction",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::GetAtt": Array [
                              "MyFunctionLambdaFunction",
                              "Arn",
                            ],
                          },
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                Object {
                                  "Fn::GetAtt": Array [
                                    "MyFunctionLambdaFunction",
                                    "Arn",
                                  ],
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-myFunction",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate default role with custom statements', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myFunction',
        description: 'My lambda resolver',
        config: {
          functionName: 'myFunction',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['lambda:invokeFunction'],
              Resource: { Ref: 'MyFunction' },
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyFunctionRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "lambda:invokeFunction",
                        ],
                        "Effect": "Allow",
                        "Resource": Object {
                          "Ref": "MyFunction",
                        },
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-myFunction",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myFunction',
        description: 'My lambda resolver',
        config: {
          functionName: 'myFunction',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('HTTP', () => {
    it('should generate Resource without roles', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://api.example.com',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyEndpoint": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My HTTP resolver",
              "HttpConfig": Object {
                "Endpoint": "https://api.example.com",
              },
              "Name": "myEndpoint",
              "Type": "HTTP",
            },
            "Type": "AWS::AppSync::DataSource",
          },
        }
      `);
    });

    it('should generate Resource with IAM authorization config', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://events.us-east-1.amazonaws.com/',
          authorizationConfig: {
            authorizationType: 'AWS_IAM',
            awsIamConfig: {
              signingRegion: { Ref: 'AWS::Region' },
              signingServiceName: 'events',
            },
          },
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['events:PutEvents'],
              Resource: ['*'],
            },
          ],
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyEndpoint": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My HTTP resolver",
              "HttpConfig": Object {
                "AuthorizationConfig": Object {
                  "AuthorizationType": "AWS_IAM",
                  "AwsIamConfig": Object {
                    "SigningRegion": Object {
                      "Ref": "AWS::Region",
                    },
                    "SigningServiceName": "events",
                  },
                },
                "Endpoint": "https://events.us-east-1.amazonaws.com/",
              },
              "Name": "myEndpoint",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyEndpointRole",
                  "Arn",
                ],
              },
              "Type": "HTTP",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsmyEndpointRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "events:PutEvents",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          "*",
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-myEndpoint",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate default role with custom statements', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://events.us-east-1.amazonaws.com/',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['events:PutEvents'],
              Resource: ['*'],
            },
          ],
          authorizationConfig: {
            authorizationType: 'AWS_IAM',
            awsIamConfig: {
              signingRegion: { Ref: 'AWS::Region' },
              signingServiceName: 'events',
            },
          },
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyEndpointRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "events:PutEvents",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          "*",
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-myEndpoint",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://events.us-east-1.amazonaws.com/',
          serviceRoleArn: 'arn:aws:iam:',
          authorizationConfig: {
            authorizationType: 'AWS_IAM',
            awsIamConfig: {
              signingRegion: { Ref: 'AWS::Region' },
              signingServiceName: 'events',
            },
          },
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('OpenSearch', () => {
    it('should generate Resource without roles', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          domain: 'myDomain',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsopensearch": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "OpenSearch resolver",
              "ElasticsearchConfig": Object {
                "AwsRegion": Object {
                  "Ref": "AWS::Region",
                },
                "Endpoint": Object {
                  "Fn::Join": Array [
                    "",
                    Array [
                      "https://",
                      Object {
                        "Fn::GetAtt": Array [
                          "myDomain",
                          "DomainEndpoint",
                        ],
                      },
                    ],
                  ],
                },
              },
              "Name": "opensearch",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsopensearchRole",
                  "Arn",
                ],
              },
              "Type": "AMAZON_OPENSEARCH_SERVICE",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsopensearchRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "es:ESHttpDelete",
                          "es:ESHttpGet",
                          "es:ESHttpHead",
                          "es:ESHttpPost",
                          "es:ESHttpPut",
                          "es:ESHttpPatch",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::Join": Array [
                              "/",
                              Array [
                                Object {
                                  "Fn::GetAtt": Array [
                                    "myDomain",
                                    "Arn",
                                  ],
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-opensearch",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate Resource with endpoint', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          endpoint: 'https://mydomain.us-east-1.es.amazonaws.com',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsopensearch": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "OpenSearch resolver",
              "ElasticsearchConfig": Object {
                "AwsRegion": Object {
                  "Ref": "AWS::Region",
                },
                "Endpoint": "https://mydomain.us-east-1.es.amazonaws.com",
              },
              "Name": "opensearch",
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsopensearchRole",
                  "Arn",
                ],
              },
              "Type": "AMAZON_OPENSEARCH_SERVICE",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsopensearchRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "es:ESHttpDelete",
                          "es:ESHttpGet",
                          "es:ESHttpHead",
                          "es:ESHttpPost",
                          "es:ESHttpPut",
                          "es:ESHttpPatch",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                "arn",
                                "aws",
                                "es",
                                "us-east-1",
                                Object {
                                  "Ref": "AWS::AccountId",
                                },
                                "domain/mydomain.us-east-1.es.amazonaws.com/*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-opensearch",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate default role with custom statements', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          domain: 'myDomain',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['es:ESHttpGet'],
              Resource: ['arn:aws:es:us-east-1:12345678:domain/myDomain'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsopensearchRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "es:ESHttpGet",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          "arn:aws:es:us-east-1:12345678:domain/myDomain",
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-opensearch",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          domain: 'myDomain',
          serviceRoleArn: 'arn:aim::',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('Relational Databases', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'RELATIONAL_DATABASE',
        name: 'myDatabase',
        description: 'My RDS database',
        config: {
          dbClusterIdentifier: 'myCluster',
          databaseName: 'myDatabase',
          awsSecretStoreArn: { Ref: 'MyRdsCluster' },
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyDatabase": Object {
            "Properties": Object {
              "ApiId": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My RDS database",
              "Name": "myDatabase",
              "RelationalDatabaseConfig": Object {
                "RdsHttpEndpointConfig": Object {
                  "AwsRegion": Object {
                    "Ref": "AWS::Region",
                  },
                  "AwsSecretStoreArn": Object {
                    "Ref": "MyRdsCluster",
                  },
                  "DatabaseName": "myDatabase",
                  "DbClusterIdentifier": Object {
                    "Fn::Join": Array [
                      ":",
                      Array [
                        "arn",
                        "aws",
                        "rds",
                        Object {
                          "Ref": "AWS::Region",
                        },
                        Object {
                          "Ref": "AWS::AccountId",
                        },
                        "cluster",
                        "myCluster",
                      ],
                    ],
                  },
                  "Schema": undefined,
                },
                "RelationalDatabaseSourceType": "RDS_HTTP_ENDPOINT",
              },
              "ServiceRoleArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlDsmyDatabaseRole",
                  "Arn",
                ],
              },
              "Type": "RELATIONAL_DATABASE",
            },
            "Type": "AWS::AppSync::DataSource",
          },
          "GraphQlDsmyDatabaseRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "rds-data:DeleteItems",
                          "rds-data:ExecuteSql",
                          "rds-data:ExecuteStatement",
                          "rds-data:GetItems",
                          "rds-data:InsertItems",
                          "rds-data:UpdateItems",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                "arn",
                                "aws",
                                "rds",
                                Object {
                                  "Ref": "AWS::Region",
                                },
                                Object {
                                  "Ref": "AWS::AccountId",
                                },
                                "cluster",
                                "myCluster",
                              ],
                            ],
                          },
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                Object {
                                  "Fn::Join": Array [
                                    ":",
                                    Array [
                                      "arn",
                                      "aws",
                                      "rds",
                                      Object {
                                        "Ref": "AWS::Region",
                                      },
                                      Object {
                                        "Ref": "AWS::AccountId",
                                      },
                                      "cluster",
                                      "myCluster",
                                    ],
                                  ],
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                      Object {
                        "Action": Array [
                          "secretsmanager:GetSecretValue",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          Object {
                            "Ref": "MyRdsCluster",
                          },
                          Object {
                            "Fn::Join": Array [
                              ":",
                              Array [
                                Object {
                                  "Ref": "MyRdsCluster",
                                },
                                "*",
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-myDatabase",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should generate DynamoDB default role with custom statement', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'RELATIONAL_DATABASE',
        name: 'myDatabase',
        description: 'My RDS database',
        config: {
          dbClusterIdentifier: 'myCluster',
          databaseName: 'myDatabase',
          awsSecretStoreArn: { Ref: 'MyRdsCluster' },
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['rds-data:DeleteItems'],
              Resource: ['arn:aws:rds:us-east-1:12345678:cluster:myCluster'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchInlineSnapshot(`
        Object {
          "GraphQlDsmyDatabaseRole": Object {
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
              "Policies": Array [
                Object {
                  "PolicyDocument": Object {
                    "Statement": Array [
                      Object {
                        "Action": Array [
                          "rds-data:DeleteItems",
                        ],
                        "Effect": "Allow",
                        "Resource": Array [
                          "arn:aws:rds:us-east-1:12345678:cluster:myCluster",
                        ],
                      },
                    ],
                    "Version": "2012-10-17",
                  },
                  "PolicyName": "AppSync-Datasource-myDatabase",
                },
              ],
            },
            "Type": "AWS::IAM::Role",
          },
        }
      `);
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(config, plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          region: 'us-east-1',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });
});

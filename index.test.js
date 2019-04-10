const Serverless = require('serverless/lib/Serverless');
const ServerlessAppsyncPlugin = require('.');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider.js');

let serverless;
let plugin;
let config;

beforeEach(() => {
  serverless = new Serverless();
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  serverless.setProvider('aws', new AwsProvider(serverless, options));
  plugin = new ServerlessAppsyncPlugin(serverless, {});
  config = {
    name: 'api',
    dataSources: [],
    region: 'us-east-1',
    isSingleConfig: true,
  };
});

describe("appsync config", () => {
  test("appsync cloudwatch role is autogenerated", () => {
    Object.assign(
      config,
      {
        logConfig: {
          level: 'ALL',
        }
      }
    );

    const role = plugin.getCloudWatchLogsRole(config);
    expect(role).toEqual(
      {
        "GraphQlApiCloudWatchLogsRole": {
          Type: 'AWS::IAM::Role',
          Properties: {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Principal": {
                    "Service": ["appsync.amazonaws.com"]
                  },
                  "Action": ["sts:AssumeRole"]
                }
              ]
            },
            Policies: [
              {
                PolicyName: "GraphQlApiCloudWatchLogsPolicy",
                PolicyDocument: {
                  Version: "2012-10-17",
                  Statement: [
                    {
                      "Effect": "Allow",
                      "Action": [
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:PutLogEvents"
                      ],
                      "Resource": [
                        {
                          "Fn::Sub": [
                            "arn:aws:logs:${region}:${AWS::AccountId}:*",
                            {
                              region: 'us-east-1'
                            }
                          ]
                        }
                      ]
                    }
                  ],
                }
              },
            ]
          }
        }
      }
    );
  });

  test("appsync cloudwatch role is not autogenerated when Logs not enabled", () => {
    const role = plugin.getCloudWatchLogsRole(config);
    expect(role).toEqual({});
  });

  test("appsync cloudwatch role is not autogenerated when loggingRoleArn is specified", () => {
    Object.assign(
      config,
      {
        logConfig: {
          level: 'ALL',
          loggingRoleArn: 'arn:aws:iam::123456789012:role/service-role/appsyncRole',
        }
      }
    );
    const role = plugin.getCloudWatchLogsRole(config);
    expect(role).toEqual({});
  });

  test('appsync cloudwatch log group is not created when are not logs enabled', () => {
    const resources = plugin.getGraphQlApiEndpointResource(config);
    expect(resources.GraphQlApiLogGroup).toBeUndefined();
  });

  test('appsync cloudwatch log group is created when logs enabled', () => {
    serverless.service.provider.logRetentionInDays = 14;
    const resources = plugin.getGraphQlApiEndpointResource({
      ...config,
      logConfig: {
        level: 'ALL',
      },
    });

    expect(resources.GraphQlApiLogGroup).toEqual({
      Properties: {
        LogGroupName: {
          'Fn::Join': ['/', ['/aws/appsync/apis', {
            'Fn::GetAtt': ['GraphQlApi', 'ApiId'],
          }]],
        },
        RetentionInDays: 14,
      },
      Type: 'AWS::Logs::LogGroup',
    });
  });

  test("Datasource generates lambdaFunctionArn from functionName", () => {

    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'lambdaSource',
            description: 'lambdaSource Desc',
            config: {
              functionName: "myFunc",
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myLambdaRole",
            }
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toEqual({
      "GraphQlDslambdaSource":
        {
          "Type": "AWS::AppSync::DataSource",
          "Properties": {
            Type: 'AWS_LAMBDA',
            "ApiId": {
              "Fn::GetAtt": [
                "GraphQlApi",
                "ApiId",
              ],
            },
            Name: 'lambdaSource',
            ServiceRoleArn: "arn:aws:iam::123456789012:role/service-role/myLambdaRole",
            Description: 'lambdaSource Desc',
            LambdaConfig: {
              LambdaFunctionArn: {
                "Fn::GetAtt": ["MyFuncLambdaFunction", "Arn"]
              },
            }
          },
        },
    });
  });

  test("Datasource uses lambdaFunctionArn when provided", () => {

    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'lambdaSource',
            description: 'lambdaSource Desc',
            config: {
              functionName: "myDummyFunc",
              lambdaFunctionArn: { "Fn::GetAtt": ["MyFuncLambdaFunction", "Arn"] },
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myLambdaRole",
            }
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toEqual({
      "GraphQlDslambdaSource":
        {
          "Type": "AWS::AppSync::DataSource",
          "Properties": {
            Type: 'AWS_LAMBDA',
            "ApiId": {
              "Fn::GetAtt": [
                "GraphQlApi",
                "ApiId",
              ],
            },
            Name: 'lambdaSource',
            ServiceRoleArn: "arn:aws:iam::123456789012:role/service-role/myLambdaRole",
            Description: 'lambdaSource Desc',
            LambdaConfig: {
              LambdaFunctionArn: {
                "Fn::GetAtt": ["MyFuncLambdaFunction", "Arn"]
              },
            }
          },
        },
    });
  });

  test("Datasource generates HTTP authorization when authorizationConfig provided", () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'HTTP',
            name: 'HTTPSource',
            description: 'HTTPSource Desc',
            config: {
              endpoint: "https://www.example.com/api",
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myHTTPRole",
              authorizationConfig: {
                 authorizationType: "AWS_IAM",
                 awsIamConfig: {
                     signingRegion: "us-east-1",
                     signingServiceName: "ses"
                 }
              }
            }
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toEqual({
      "GraphQlDsHTTPSource":
        {
          "Type": "AWS::AppSync::DataSource",
          "Properties": {
            Type: 'HTTP',
            "ApiId": {
              "Fn::GetAtt": [
                "GraphQlApi",
                "ApiId",
              ],
            },
            Name: 'HTTPSource',
            ServiceRoleArn: "arn:aws:iam::123456789012:role/service-role/myHTTPRole",
            Description: 'HTTPSource Desc',
            HttpConfig: {
              Endpoint: "https://www.example.com/api",
              AuthorizationConfig: {
                AuthorizationType: "AWS_IAM",
                AwsIamConfig:{
                  SigningRegion: "us-east-1",
                  SigningServiceName: "ses"
                 }
                  
                } 
              }
          },
        },
    });
  });
});


describe("iamRoleStatements", () => {

  test("getDataSourceIamRolesResouces with Specific statementss", () => {

    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'LambdaSource',
            description: 'My Lambda Source',
            config: {
              lambdaFunctionArn: "{ Fn::GetAtt: [MyTestFunctionLambdaFunction, Arn] }",
              iamRoleStatements: [
                {
                  Effect: "Allow",
                  Action: ["lambda:invokeFunction"],
                  Resource: [
                    "arn:aws:lambda:us-east-1:123456789012:function:myTestFunction",
                  ],
                },
              ],
            },
          },
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            description: 'My DynamoDb Source',
            config: {
              tableName: "myTable",
              iamRoleStatements: [
                {
                  Effect: "Allow",
                  Action: [
                    "dynamodb:Query",
                    "dynamodb:Scan",
                  ],
                  Resource: [
                    "arn:aws:dynamodb:us-east-1:123456789012:table/myTable",
                    "arn:aws:dynamodb:us-east-1:123456789012:table/myTable/*",
                  ],
                },
              ],
            }
          },
          {
            type: 'RELATIONAL_DATABASE',
            name: 'RelationalDatabaseSource',
            description: 'Relational database Source',
            config: {
              region: "us-east-1",
              dbClusterIdentifier: "aurora-cluster-id",
              databaseName: "myDatabaseName",
              schema: "mySchema",
              awsSecretStoreArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
              iamRoleStatements: [
                {
                  "Action": [
                    "rds-data:DeleteItems",
                    "rds-data:ExecuteSql",
                    "rds-data:GetItems",
                    "rds-data:InsertItems",
                    "rds-data:UpdateItems",
                  ],
                  "Resource": [
                    "arn:aws:rds:us-east-1:123456789012:cluster:aurora-cluster-id",
                    "arn:aws:rds:us-east-1:123456789012:cluster:aurora-cluster-id:*",
                  ],
                  "Effect": "Allow",
                },
                {
                  "Action": [
                    "secretsmanager:GetSecretValue",
                  ],
                  "Resource": [
                    "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
                    "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa:*",
                  ],
                  "Effect": "Allow",
                },
              ],
            }
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource',
            description: 'My ElasticSearch Source',
            config: {
              region: "us-east-1",
              endpoint: "https://search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com",
              iamRoleStatements: [
                {
                  Effect: "Allow",
                  Action: [
                    "ES:ESHttpGet",
                  ],
                  Resource: [
                    "arn:aws:es:us-east-1:123456789012:domain/my-domain",
                  ],
                },
              ],
            }
          },
        ]
      }
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toEqual(
      {
        "GraphQlDsLambdaSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "sts:AssumeRole",
                  ],
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsLambdaSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Action": [
                        "lambda:invokeFunction",
                      ],
                      "Resource": [
                        "arn:aws:lambda:us-east-1:123456789012:function:myTestFunction",
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
        "GraphQlDsDynamoDbSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "sts:AssumeRole",
                  ],
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsDynamoDbSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Action": [
                        "dynamodb:Query",
                        "dynamodb:Scan",
                      ],
                      "Resource": [
                        "arn:aws:dynamodb:us-east-1:123456789012:table/myTable",
                        "arn:aws:dynamodb:us-east-1:123456789012:table/myTable/*",
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
        "GraphQlDsRelationalDatabaseSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com"
                    ]
                  },
                  "Action": [
                    "sts:AssumeRole"
                  ]
                }
              ]
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsRelationalDatabaseSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Action": [
                        "rds-data:DeleteItems",
                        "rds-data:ExecuteSql",
                        "rds-data:GetItems",
                        "rds-data:InsertItems",
                        "rds-data:UpdateItems"
                      ],
                      "Resource": [
                        "arn:aws:rds:us-east-1:123456789012:cluster:aurora-cluster-id",
                        "arn:aws:rds:us-east-1:123456789012:cluster:aurora-cluster-id:*"
                      ],
                      "Effect": "Allow"
                    },
                    {
                      "Action": [
                        "secretsmanager:GetSecretValue"
                      ],
                      "Resource": [
                        "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
                        "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa:*"
                      ],
                      "Effect": "Allow"
                    }
                  ]
                }
              }
            ]
          }
        },
        "GraphQlDsElasticSearchSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "sts:AssumeRole",
                  ],
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsElasticSearchSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      Action: [
                        "ES:ESHttpGet",
                      ],
                      Resource: [
                        "arn:aws:es:us-east-1:123456789012:domain/my-domain",
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    );
  });


  test("getDataSourceIamRolesResouces with Default generated statements", () => {

    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'LambdaSource',
            description: 'My Lambda Source',
            config: {
              lambdaFunctionArn: "{ Fn::GetAtt: [MyTestFunctionLambdaFunction, Arn] }",
            },
          },
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            description: 'My DynamoDb Source',
            config: {
              tableName: "myTable",
              region: "us-east-1",
            }
          },
          {
            type: 'RELATIONAL_DATABASE',
            name: 'RelationalDbSource',
            description: 'Relational Db Source',
            config: {
              region: "us-east-1",
              dbClusterIdentifier: "aurora-cluster-id",
              databaseName: "myDatabaseName",
              schema: "mySchema",
              awsSecretStoreArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource',
            description: 'My ElasticSearch Source',
            config: {
              region: "us-east-1",
              endpoint: "https://search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com",
            }
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toEqual(
      {
        "GraphQlDsLambdaSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "sts:AssumeRole",
                  ],
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsLambdaSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Action": [
                        "lambda:invokeFunction",
                      ],
                      "Resource": [
                        "{ Fn::GetAtt: [MyTestFunctionLambdaFunction, Arn] }",
                        {
                          "Fn::Join": [
                            ":",
                            [
                              "{ Fn::GetAtt: [MyTestFunctionLambdaFunction, Arn] }",
                              '*'
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
        "GraphQlDsDynamoDbSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "sts:AssumeRole",
                  ],
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsDynamoDbSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Action": [
                        "dynamodb:DeleteItem",
                        "dynamodb:GetItem",
                        "dynamodb:PutItem",
                        "dynamodb:Query",
                        "dynamodb:Scan",
                        "dynamodb:UpdateItem",
                        "dynamodb:BatchGetItem",
                        "dynamodb:BatchWriteItem"
                      ],
                      "Resource": [
                        {
                          "Fn::Join": [":", [
                            'arn',
                            'aws',
                            'dynamodb',
                            'us-east-1',
                            { "Ref": "AWS::AccountId" },
                            { "Fn::Join": ["/", ['table', 'myTable']] },
                          ]]
                        },
                        {
                          "Fn::Join": ["/", [
                            {
                              "Fn::Join": [":", [
                                'arn',
                                'aws',
                                'dynamodb',
                                'us-east-1',
                                { "Ref": "AWS::AccountId" },
                                { "Fn::Join": ["/", ['table', 'myTable']] },
                              ]]
                            },
                            '*'
                          ]]
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
        "GraphQlDsElasticSearchSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "sts:AssumeRole",
                  ],
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsElasticSearchSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      Action: [
                        "es:ESHttpDelete",
                        "es:ESHttpGet",
                        "es:ESHttpHead",
                        "es:ESHttpPost",
                        "es:ESHttpPut",
                      ],
                      Resource: [
                        {
                          "Fn::Join": [":", [
                            'arn',
                            'aws',
                            'es',
                            'us-east-1',
                            { "Ref": "AWS::AccountId" },
                            "domain/search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com"
                          ]]
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
        "GraphQlDsRelationalDbSourceRole": {
          "Type": "AWS::IAM::Role",
          "Properties": {
            "AssumeRolePolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Principal": {
                    "Service": [
                      "appsync.amazonaws.com",
                    ],
                  },
                  "Action": [
                    "sts:AssumeRole",
                  ],
                },
              ],
            },
            "Policies": [
              {
                "PolicyName": "GraphQlDsRelationalDbSourcePolicy",
                "PolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Action": [
                        "rds-data:DeleteItems",
                        "rds-data:ExecuteSql",
                        "rds-data:GetItems",
                        "rds-data:InsertItems",
                        "rds-data:UpdateItems"
                      ],
                      "Resource": [
                        {
                          "Fn::Join": [
                            ":",
                            [
                              "arn",
                              "aws",
                              "rds",
                              "us-east-1",
                              {
                                "Ref":"AWS::AccountId",
                              },
                              "cluster",
                              "aurora-cluster-id",
                            ],
                          ],
                        },
                        {
                          "Fn::Join": [
                            ":",
                            [
                              {
                                "Fn::Join": [
                                  ":",
                                  [
                                    "arn",
                                    "aws",
                                    "rds",
                                    "us-east-1",
                                    {
                                      "Ref": "AWS::AccountId",
                                    },
                                    "cluster",
                                    "aurora-cluster-id",
                                  ],
                                ],
                              },
                              "*",
                            ],
                          ],
                        },
                      ],
                    },
                    {
                      "Effect": "Allow",
                      "Action": [
                        "secretsmanager:GetSecretValue",
                      ],
                      "Resource": [
                        "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
                        {
                          "Fn::Join": [
                            ":",
                            [
                              "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
                              "*",
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    );
  });

  test("using a serviceRoleArn should not generate any new Role", () => {

    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'LambdaSource',
            description: 'My Lambda Source',
            config: {
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myLambdaRole",
              lambdaFunctionArn: "{ Fn::GetAtt: [MyTestFunctionLambdaFunction, Arn] }",
            },
          },
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            description: 'My DynamoDb Source',
            config: {
              tableName: "myTable",
              region: "us-east-1",
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myDynamoDbRole",
            },
          },
          {
            type: 'RELATIONAL_DATABASE',
            name: 'RelationalDbSource',
            description: 'Relational Db Source',
            config: {
              region: "us-east-1",
              dbClusterIdentifier: "aurora-cluster-id",
              databaseName: "myDatabaseName",
              schema: "mySchema",
              awsSecretStoreArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa",
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myRelationalDbRole",
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource',
            description: 'My ElasticSearch Source',
            config: {
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myEsRole",
              region: "us-east-1",
              endpoint: "https://search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com",
            },
          },
          {
            type: 'HTTP',
            name: 'HTTPSource',
            description: 'My ElasticSearch Source',
            config: {
              serviceRoleArn: "arn:aws:iam::123456789012:role/service-role/myHTTPRole",
              region: "us-east-1",
              endpoint: "https://www.example.com/api",
            },
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toEqual({});
  });

  test("Datasources of type NONE or HTTP should not generate any default role", () => {

    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'NONE',
            name: 'NoneSource',
          },
          {
            type: 'HTTP',
            name: 'HttpSource',
            config: {
              endpoint: "https://www.example.com/api"
            }
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toEqual({});
  });

  describe("template substitutions", () => {
    test("Templates with substitutions should be transformed into Fn::Join with Fn::Sub objects", () => {

      let template = "#set($partitionKey = \"${globalPK}\")\n" +
        "{\n" +
        "\"version\" : \"2018-05-29\",\n" +
        "\"operation\" : \"GetItem\",\n" +
        "\"key\" : {\n" +
        "\"partitionKey\": { \"S\": \"${globalPK}\" },\n" +
        "\"sortKey\": { \"S\": \"${globalSK}\" },\n" +
        "}\n" +
        "}";

      let variables =
        {
          globalPK: "PK",
          globalSK: "SK",
        };

      const transformedTemplate = plugin.substituteGlobalTemplateVariables(template, variables);
      expect(transformedTemplate).toEqual(
        {
          "Fn::Join": [
            "",
            [
              '#set($partitionKey = "',
              {
                'Fn::Sub':
                  [
                    '${globalPK}', { "globalPK": "PK" }
                  ]
              },
              '")\n{\n"version" : "2018-05-29",\n"operation" : "GetItem",\n"key" : {\n"partitionKey": { "S": "',
              {
                'Fn::Sub':
                  [
                    '${globalPK}', { "globalPK": "PK" }
                  ]
              },
              '" },\n"sortKey": { "S": \"',
              {
                'Fn::Sub':
                  [
                    '${globalSK}', { "globalSK": "SK" }
                  ]
              },
              '" },\n}\n}'
            ]
          ]
        });
    });
  });
});

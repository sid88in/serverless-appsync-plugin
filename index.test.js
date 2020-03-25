/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const chalk = require('chalk');
const Serverless = require('serverless/lib/Serverless');
const ServerlessAppsyncPlugin = require('./src');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider.js');

let serverless;
let plugin;
let config;
jest.spyOn(Date, 'now').mockImplementation(() => 10000);

jest.mock('fs');
jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');

beforeEach(() => {
  const cli = {
    log: jest.fn(),
    consoleLog: jest.fn(),
  };
  serverless = new Serverless();
  serverless.cli = cli;

  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  serverless.setProvider('aws', new AwsProvider(serverless, options));
  plugin = new ServerlessAppsyncPlugin(serverless, {});
  config = {
    additionalAuthenticationProviders: [],
    name: 'api',
    dataSources: [],
    region: 'us-east-1',
    isSingleConfig: true,
    mappingTemplatesLocation: 'mapping-templates',
    substitutions: {},
  };
});

describe('appsync display', () => {
  test('appsync api keys are displayed', () => {
    plugin.gatheredData.apiKeys = ['dummy-api-key-1', 'dummy-api-key-2'];

    let expectedMessage = '';
    expectedMessage += `${chalk.yellow('appsync api keys:')}`;
    expectedMessage += '\n  dummy-api-key-1';
    expectedMessage += '\n  dummy-api-key-2';

    expect(plugin.displayApiKeys()).toEqual(expectedMessage);
  });

  test('appsync api keys are hidden when `--conceal` is given', () => {
    plugin.options.conceal = true;
    plugin.gatheredData.apiKeys = ['dummy-api-key-1', 'dummy-api-key-2'];

    let expectedMessage = '';
    expectedMessage += `${chalk.yellow('appsync api keys:')}`;
    expectedMessage += '\n  *** (concealed)';
    expectedMessage += '\n  *** (concealed)';

    expect(plugin.displayApiKeys()).toEqual(expectedMessage);
  });
});

describe('appsync config', () => {
  test('appsync cloudwatch role is autogenerated', () => {
    Object.assign(
      config,
      {
        logConfig: {
          level: 'ALL',
        },
      },
    );

    const role = plugin.getCloudWatchLogsRole(config);
    expect(role).toMatchSnapshot();
  });

  test('appsync cloudwatch role is not autogenerated when Logs not enabled', () => {
    const role = plugin.getCloudWatchLogsRole(config);
    expect(role).toEqual({});
  });

  test('appsync cloudwatch role is not autogenerated when loggingRoleArn is specified', () => {
    Object.assign(
      config,
      {
        logConfig: {
          level: 'ALL',
          loggingRoleArn: 'arn:aws:iam::123456789012:role/service-role/appsyncRole',
        },
      },
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

    expect(resources.GraphQlApiLogGroup).toMatchSnapshot();
  });

  test('Datasource generates lambdaFunctionArn from functionName', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'lambdaSource',
            description: 'lambdaSource Desc',
            config: {
              functionName: 'myFunc',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myLambdaRole',
            },
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toMatchSnapshot();
  });

  test('Datasource uses lambdaFunctionArn when provided', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'lambdaSource',
            description: 'lambdaSource Desc',
            config: {
              functionName: 'myDummyFunc',
              lambdaFunctionArn: { 'Fn::GetAtt': ['MyFuncLambdaFunction', 'Arn'] },
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myLambdaRole',
            },
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toMatchSnapshot();
  });

  test('Datasource generates HTTP authorization when authorizationConfig provided', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'HTTP',
            name: 'HTTPSource',
            description: 'HTTPSource Desc',
            config: {
              endpoint: 'https://www.example.com/api',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myHTTPRole',
              authorizationConfig: {
                authorizationType: 'AWS_IAM',
                awsIamConfig: {
                  signingRegion: 'us-east-1',
                  signingServiceName: 'ses',
                },
              },
            },
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toMatchSnapshot();
  });

  test("HTTP Datasource defaults the IAM role signing region to the stack's region", () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'HTTP',
            name: 'HTTPSource',
            description: 'HTTPSource Desc',
            config: {
              endpoint: 'https://www.example.com/api',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myHTTPRole',
              authorizationConfig: {
                authorizationType: 'AWS_IAM',
                awsIamConfig: {
                  signingServiceName: 'ses',
                },
              },
            },
          },
        ],
      },
    );

    const dataSources = plugin.getDataSourceResources(config);
    expect(dataSources).toMatchSnapshot();
  });

  test('AMAZON_COGNITO_USER_POOLS config created', () => {
    const resources = plugin.getGraphQlApiEndpointResource({
      ...config,
      authenticationType: 'AMAZON_COGNITO_USER_POOLS',
      userPoolConfig: {
        defaultAction: 'ALLOW',
        awsRegion: 'eu-central-1',
        userPoolId: 'userPoolGenerateId',
        appIdClientRegex: 'appIdClientRegex',
      },
    });
    expect(resources.GraphQlApi.Properties.AuthenticationType).toBe('AMAZON_COGNITO_USER_POOLS');
    expect(resources.GraphQlApi.Properties.UserPoolConfig).toEqual({
      DefaultAction: 'ALLOW',
      AwsRegion: 'eu-central-1',
      UserPoolId: 'userPoolGenerateId',
      AppIdClientRegex: 'appIdClientRegex',
    });
  });

  test('Tags config created', () => {
    const resources = plugin.getGraphQlApiEndpointResource({
      ...config,
      tags: {
        testKey: 'testValue',
      },
    });
    expect(resources.GraphQlApi.Properties.Tags).toEqual(expect.arrayContaining([{
      Key: 'testKey',
      Value: 'testValue',
    }]));
  });

  test('OPENID_CONNECT config created', () => {
    const resources = plugin.getGraphQlApiEndpointResource({
      ...config,
      authenticationType: 'OPENID_CONNECT',
      openIdConnectConfig: {
        issuer: 'issuer',
        clientId: 'clientId',
        iatTTL: 1000,
        authTTL: 1000,
      },
    });
    expect(resources.GraphQlApi.Properties.AuthenticationType).toBe('OPENID_CONNECT');
    expect(resources.GraphQlApi.Properties.OpenIDConnectConfig).toEqual({
      Issuer: 'issuer',
      ClientId: 'clientId',
      IatTTL: 1000,
      AuthTTL: 1000,
    });
  });

  test('API_KEY config created', () => {
    const apiConfig = {
      ...config,
      authenticationType: 'API_KEY',
    };
    const apiResources = plugin.getGraphQlApiEndpointResource(apiConfig);
    const keyResources = plugin.getApiKeyResources(apiConfig);
    const outputs = plugin.getApiKeyOutputs(apiConfig);

    expect(apiResources.GraphQlApi.Properties.AuthenticationType).toBe('API_KEY');
    expect(keyResources.GraphQlApiKeyDefault).toEqual({
      Type: 'AWS::AppSync::ApiKey',
      Properties: {
        ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
        Description: 'serverless-appsync-plugin: AppSync API Key for GraphQlApiKeyDefault',
        Expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
      },
    });
    expect(outputs).toEqual({
      GraphQlApiKeyDefault: {
        Value: { 'Fn::GetAtt': ['GraphQlApiKeyDefault', 'ApiKey'] },
      },
    });
  });

  test('Additional authentication providers created', () => {
    const apiConfig = {
      ...config,
      additionalAuthenticationProviders: [
        {
          authenticationType: 'AMAZON_COGNITO_USER_POOLS',
          userPoolConfig: {
            awsRegion: 'eu-central-1',
            userPoolId: 'userPoolGenerateId',
            appIdClientRegex: 'appIdClientRegex',
          },
        },
        {
          authenticationType: 'OPENID_CONNECT',
          openIdConnectConfig: {
            issuer: 'issuer',
            clientId: 'clientId',
            iatTTL: 1000,
            authTTL: 1000,
          },
        },
        {
          authenticationType: 'API_KEY',
        },
        {
          authenticationType: 'AWS_IAM',
        },
      ],
    };

    const apiResources = plugin.getGraphQlApiEndpointResource(apiConfig);
    const keyResources = plugin.getApiKeyResources(apiConfig);
    const outputs = plugin.getApiKeyOutputs(apiConfig);

    expect(apiResources.GraphQlApi.Properties.AdditionalAuthenticationProviders).toMatchSnapshot();
    expect(keyResources.GraphQlApiKeyDefault).toMatchSnapshot();
    expect(outputs).toEqual({
      GraphQlApiKeyDefault: {
        Value: { 'Fn::GetAtt': ['GraphQlApiKeyDefault', 'ApiKey'] },
      },
    });
  });
});

describe('Caching', () => {
  test('Disabled', () => {
    const apiResources = plugin.getApiCachingResource(config);
    expect(apiResources).toMatchSnapshot();
  });

  test('Minimum configuration', () => {
    const apiConfig = {
      ...config,
      caching: {
        behavior: 'FULL_REQUEST_CACHING',
      },
    };

    const apiResources = plugin.getApiCachingResource(apiConfig);
    expect(apiResources).toMatchSnapshot();
  });

  test('Custom configuration', () => {
    const apiConfig = {
      ...config,
      caching: {
        behavior: 'FULL_REQUEST_CACHING',
        atRestEncryption: true,
        transitEncryption: true,
        ttl: 500,
        type: 'T2_MEDIUM',
      },
    };

    const apiResources = plugin.getApiCachingResource(apiConfig);
    expect(apiResources).toMatchSnapshot();
  });

  test('Resolver min config', () => {
    const apiConfig = {
      ...config,
      caching: {
        behavior: 'PER_RESOLVER_CACHING',
      },
      mappingTemplates: [
        {
          dataSource: 'ds',
          type: 'Query',
          field: 'field',
          caching: true,
        },
      ],
    };

    const apiResources = plugin.getResolverResources(apiConfig);
    expect(apiResources).toMatchSnapshot();
  });

  test('Resolver custom config', () => {
    const apiConfig = {
      ...config,
      caching: {
        behavior: 'PER_RESOLVER_CACHING',
      },
      mappingTemplates: [
        {
          dataSource: 'ds',
          type: 'Query',
          field: 'field',
          caching: {
            ttl: 1000,
            keys: [
              '$context.identity.sub',
              '$context.arguments.id',
            ],
          },
        },
      ],
    };

    const apiResources = plugin.getResolverResources(apiConfig);
    expect(apiResources).toMatchSnapshot();
  });

  test('Resolver with fallback', () => {
    const apiConfig = {
      ...config,
      caching: {
        behavior: 'PER_RESOLVER_CACHING',
        ttl: 2000,
      },
      mappingTemplates: [
        {
          dataSource: 'ds',
          type: 'Query',
          field: 'field',
          caching: {
            keys: [
              '$context.identity.sub',
              '$context.arguments.id',
            ],
          },
        },
      ],
    };

    const apiResources = plugin.getResolverResources(apiConfig);
    expect(apiResources).toMatchSnapshot();
  });
});

describe('iamRoleStatements', () => {
  test('getDataSourceIamRolesResouces with Specific statements', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'LambdaSource',
            description: 'My Lambda Source',
            config: {
              lambdaFunctionArn: { 'Fn::GetAtt': ['MyTestFunctionLambdaFunction', 'Arn'] },
              iamRoleStatements: [
                {
                  Effect: 'Allow',
                  Action: ['lambda:invokeFunction'],
                  Resource: [
                    'arn:aws:lambda:us-east-1:123456789012:function:myTestFunction',
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
              tableName: 'myTable',
              iamRoleStatements: [
                {
                  Effect: 'Allow',
                  Action: [
                    'dynamodb:Query',
                    'dynamodb:Scan',
                  ],
                  Resource: [
                    'arn:aws:dynamodb:us-east-1:123456789012:table/myTable',
                    'arn:aws:dynamodb:us-east-1:123456789012:table/myTable/*',
                  ],
                },
              ],
            },
          },
          {
            type: 'RELATIONAL_DATABASE',
            name: 'RelationalDatabaseSource',
            description: 'Relational database Source',
            config: {
              region: 'us-east-1',
              dbClusterIdentifier: 'aurora-cluster-id',
              databaseName: 'myDatabaseName',
              schema: 'mySchema',
              awsSecretStoreArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa',
              iamRoleStatements: [
                {
                  Action: [
                    'rds-data:DeleteItems',
                    'rds-data:ExecuteSql',
                    'rds-data:GetItems',
                    'rds-data:InsertItems',
                    'rds-data:UpdateItems',
                  ],
                  Resource: [
                    'arn:aws:rds:us-east-1:123456789012:cluster:aurora-cluster-id',
                    'arn:aws:rds:us-east-1:123456789012:cluster:aurora-cluster-id:*',
                  ],
                  Effect: 'Allow',
                },
                {
                  Action: [
                    'secretsmanager:GetSecretValue',
                  ],
                  Resource: [
                    'arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa',
                    'arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa:*',
                  ],
                  Effect: 'Allow',
                },
              ],
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource',
            description: 'My ElasticSearch Source',
            config: {
              region: 'us-east-1',
              endpoint: 'https://search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com',
              iamRoleStatements: [
                {
                  Effect: 'Allow',
                  Action: [
                    'ES:ESHttpGet',
                  ],
                  Resource: [
                    'arn:aws:es:us-east-1:123456789012:domain/my-domain',
                  ],
                },
              ],
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource2',
            description: 'other ES Source',
            config: {
              region: 'us-east-1',
              endpoint: {
                'Fn::GetAtt': [
                  'EsResource',
                  'DomainName',
                ],
              },
              iamRoleStatements: [
                {
                  Effect: 'Allow',
                  Action: [
                    'ES:ESHttpGet',
                  ],
                  Resource: [
                    {
                      'Fn::GetAtt': [
                        'EsResource',
                        'Arn',
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toMatchSnapshot();
  });


  test('getDataSourceIamRolesResouces with Default generated statements', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'LambdaSource',
            description: 'My Lambda Source',
            config: {
              lambdaFunctionArn: { 'Fn::GetAtt': ['MyTestFunctionLambdaFunction', 'Arn'] },
            },
          },
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            description: 'My DynamoDb Source',
            config: {
              tableName: 'myTable',
              region: 'us-east-1',
            },
          },
          {
            type: 'RELATIONAL_DATABASE',
            name: 'RelationalDbSource',
            description: 'Relational Db Source',
            config: {
              region: 'us-east-1',
              dbClusterIdentifier: 'aurora-cluster-id',
              databaseName: 'myDatabaseName',
              schema: 'mySchema',
              awsSecretStoreArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa',
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource',
            description: 'My ElasticSearch Source',
            config: {
              region: 'us-east-1',
              endpoint: 'https://search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com',
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource2',
            description: 'other ES Source',
            config: {
              region: 'us-east-1',
              endpoint: {
                'Fn::GetAtt': [
                  'EsResource',
                  'DomainName',
                ],
              },
            },
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toMatchSnapshot();
  });

  test('using a serviceRoleArn should not generate any new Role', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AWS_LAMBDA',
            name: 'LambdaSource',
            description: 'My Lambda Source',
            config: {
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myLambdaRole',
              lambdaFunctionArn: { 'Fn::GetAtt': ['MyTestFunctionLambdaFunction', 'Arn'] },
            },
          },
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            description: 'My DynamoDb Source',
            config: {
              tableName: 'myTable',
              region: 'us-east-1',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myDynamoDbRole',
            },
          },
          {
            type: 'RELATIONAL_DATABASE',
            name: 'RelationalDbSource',
            description: 'Relational Db Source',
            config: {
              region: 'us-east-1',
              dbClusterIdentifier: 'aurora-cluster-id',
              databaseName: 'myDatabaseName',
              schema: 'mySchema',
              awsSecretStoreArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-cluster-secret-XuztPa',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myRelationalDbRole',
            },
          },
          {
            type: 'AMAZON_ELASTICSEARCH',
            name: 'ElasticSearchSource',
            description: 'My ElasticSearch Source',
            config: {
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myEsRole',
              region: 'us-east-1',
              endpoint: 'https://search-my-domain-abcdefghijklmnop.us-east-1.es.amazonaws.com',
            },
          },
          {
            type: 'HTTP',
            name: 'HTTPSource',
            description: 'My HTTP Source',
            config: {
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myHTTPRole',
              region: 'us-east-1',
              endpoint: 'https://www.example.com/api',
            },
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toEqual({});
  });

  test('Datasources of type NONE or HTTP should not generate any default role', () => {
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
              endpoint: 'https://www.example.com/api',
            },
          },
        ],
      },
    );

    const roles = plugin.getDataSourceIamRolesResouces(config);
    expect(roles).toEqual({});
  });

  describe('template substitutions', () => {
    test('Templates with substitutions should be transformed into Fn::Join with Fn::Sub objects', () => {
      const template = '#set($partitionKey = "${globalPK}")\n' +
        '{\n' +
        '"version" : "2018-05-29",\n' +
        '"operation" : "GetItem",\n' +
        '"key" : {\n' +
        '"partitionKey": { "S": "${globalPK}" },\n' +
        '"sortKey": { "S": "${globalSK}" },\n' +
        '}\n' +
        '}';

      const variables =
      {
        globalPK: 'PK',
        globalSK: 'SK',
      };

      const transformedTemplate = plugin.substituteGlobalTemplateVariables(template, variables);
      expect(transformedTemplate).toMatchSnapshot();
    });
  });

  describe('individual template substitutions', () => {
    test('Substitutions for individual template should override global substitutions.', () => {
      const template = '#set($partitionKey = "${globalPK}")\n' +
        '{\n' +
        '"version" : "2018-05-29",\n' +
        '"operation" : "GetItem",\n' +
        '"key" : {\n' +
        '"partitionKey": { "S": "${globalPK}" },\n' +
        '"sortKey": { "S": "${globalSK}" },\n' +
        '}\n' +
        '}';

      const configuration =
      {
        substitutions:
        {
          globalPK: 'WrongValue',
          globalSK: 'WrongValue',
        },
      };

      const individualSubstitutions =
      {
        globalPK: 'PK',
        globalSK: 'SK',
      };

      const transformedTemplate = plugin.processTemplate(
        template,
        configuration,
        individualSubstitutions,
      );
      expect(transformedTemplate).toMatchSnapshot();
    });
  });
});

describe('Delta sync', () => {
  test('not versioned', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            config: {
              tableName: 'myTable',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myDynamoDbRole',
              region: 'us-east-1',
            },
          },
        ],
      },
    );

    const result = plugin.getDataSourceResources(config);
    expect(result).toMatchSnapshot();
  });

  test('with default TTL values', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            config: {
              tableName: 'myTable',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myDynamoDbRole',
              region: 'us-east-1',
              versioned: true,
              deltaSyncConfig: {
                deltaSyncTableName: 'myDeltaSynTable',
              },
            },
          },
        ],
      },
    );

    const result = plugin.getDataSourceResources(config);
    expect(result).toMatchSnapshot();
  });

  test('custom config works', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            config: {
              tableName: 'myTable',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myDynamoDbRole',
              region: 'us-east-1',
              versioned: true,
              deltaSyncConfig: {
                deltaSyncTableName: 'myDeltaSynTable',
                baseTableTTL: 10,
                deltaSyncTableTTL: 30,
              },
            },
          },
        ],
      },
    );

    const result = plugin.getDataSourceResources(config);
    expect(result).toMatchSnapshot();
  });

  test('missing tableName throws an error', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            config: {
              tableName: 'myTable',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myDynamoDbRole',
              region: 'us-east-1',
              versioned: true,
              deltaSyncConfig: {
              },
            },
          },
        ],
      },
    );

    expect(() => {
      plugin.getDataSourceResources(config);
    }).toThrowErrorMatchingSnapshot();
  });

  test('missing config throws an error', () => {
    Object.assign(
      config,
      {
        dataSources: [
          {
            type: 'AMAZON_DYNAMODB',
            name: 'DynamoDbSource',
            config: {
              tableName: 'myTable',
              serviceRoleArn: 'arn:aws:iam::123456789012:role/service-role/myDynamoDbRole',
              region: 'us-east-1',
              versioned: true,
            },
          },
        ],
      },
    );

    expect(() => {
      plugin.getDataSourceResources(config);
    }).toThrowErrorMatchingSnapshot();
  });
});

import path from 'path';
import getAppSyncConfig from '../getAppSyncConfig';

describe('getAppSyncConfig', () => {
  it('should generate a valid config', () => {
    const config = {
      name: 'myAPI',
      authenticationType: 'API_KEY',
      defaultMappingTemplates: {
        request: 'default.request.vtl',
        response: 'default.response.vtl',
      },
      mappingTemplates: [
        {
          dataSource: 'lambda',
          type: 'Query',
          field: 'templates',
          request: 'lambda.request.vtl',
          response: 'lambda.response.vtl',
          substitutions: {
            mySubVar: 'lambda',
          },
        },
        {
          dataSource: 'lambda',
          type: 'Query',
          field: 'default',
          substitutions: {
            mySubVar: 'default',
          },
        },
        {
          dataSource: 'lambda',
          type: 'Query',
          field: 'directLambda',
          request: false,
          response: false,
        },
        {
          type: 'Query',
          kind: 'PIPELINE',
          field: 'pipeline',
          functions: ['func', 'func-default'],
          substitutions: {
            mySubVar: 'pipeline',
          },
        },
      ],
      functionConfigurations: [
        {
          dataSource: 'lambda',
          name: 'func',
          request: 'lambda.request.vtl',
          response: 'lambda.response.vtl',
          substitutions: {
            mySubVar: 'template-function',
          },
        },
        {
          dataSource: 'lambda',
          name: 'func-default',
          substitutions: {
            mySubVar: 'default-function',
          },
        },
        {
          dataSource: 'lambda',
          name: 'func-direct',
          request: false,
          response: false,
        },
      ],
      dataSources: [
        {
          type: 'AWS_LAMBDA',
          name: 'lambda',
          config: {
            functionName: 'getPosts',
          },
        },
        {
          type: 'AMAZON_DYNAMODB',
          name: 'dynamodb',
          config: {
            tableName: 'myTable',
          },
        },
        {
          type: 'HTTP',
          name: 'http',
          config: {
            endpoint: 'http://127.0.0.1',
          },
        },
      ],
    };

    const result = getAppSyncConfig(
      {
        options: {
          apiKey: '123456789',
          dynamoDb: {
            endpoint: `http://localhost:8000`,
            region: 'localhost',
            accessKeyId: 'DEFAULT_ACCESS_KEY',
            secretAccessKey: 'DEFAULT_SECRET',
          },
        },
        serverless: {
          config: { servicePath: path.join(__dirname, 'files') },
          service: {
            functions: {
              getPost: {
                hndler: 'index.handler',
              },
              getPosts: {
                hndler: 'index.handler',
              },
            },
          },
        },
      },
      config,
    );
    expect(result.appSync).toMatchSnapshot();
    expect(result.schema).toMatchSnapshot();
    expect(result.resolvers).toMatchSnapshot();
    expect(result.dataSources).toMatchSnapshot();
    expect(result.functions).toMatchSnapshot();
  });
});

import { pick } from 'lodash-es';
import { getAppSyncConfig } from '../getAppSyncConfig.js';
import { basicConfig } from './basicConfig.js';
import { ResolverConfig } from '../types/index.js';

test('returns basic config', async () => {
  expect(getAppSyncConfig(basicConfig)).toMatchSnapshot();
});

describe('Schema', () => {
  it('should return the default schema', () => {
    const config = getAppSyncConfig({ ...basicConfig, schema: undefined });
    const schema = 'schema' in config ? config.schema : undefined;
    expect(schema).toMatchSnapshot();
  });

  it('should return a single schema as an array', () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      schema: 'mySchema.graphql',
    });
    const schema = 'schema' in config ? config.schema : undefined;
    expect(schema).toMatchSnapshot();
  });

  it('should return a schema array unchanged', () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      schema: ['users.graphql', 'posts.graphql'],
    });
    const schema = 'schema' in config ? config.schema : undefined;
    expect(schema).toMatchSnapshot();
  });
});

describe('Api Keys', () => {
  it('should not generate a default Api Key when auth is not API_KEY', () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      authentication: { type: 'AWS_IAM' },
    });
    const apiKeys = 'apiKeys' in config ? config.apiKeys : undefined;
    expect(apiKeys).toBeUndefined();
  });

  it('should generate api keys', () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      apiKeys: [
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
    });
    const apiKeys = 'apiKeys' in config ? config.apiKeys : undefined;

    expect(apiKeys).toMatchInlineSnapshot(`
      Object {
        "InlineKey": Object {
          "name": "InlineKey",
        },
        "Jane": Object {
          "expiresAfter": "1y",
          "name": "Jane",
        },
        "John": Object {
          "description": "John's key",
          "expiresAt": "2021-03-09T16:00:00+00:00",
          "name": "John",
        },
      }
    `);
  });
});

describe('DataSources', () => {
  it('should merge dataSource arrays', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      dataSources: [
        {
          myDataSource: {
            type: 'NONE',
          },
          myOtherDataSource: {
            type: 'NONE',
          },
        },
        {
          otherSource: {
            type: 'NONE',
          },
          anotherNamedSource: {
            type: 'NONE',
          },
        },
      ],
    });
    expect(config.dataSources).toMatchSnapshot();
  });

  it('should merge dataSources embedded into resolvers and pipelineFunctions', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      dataSources: {
        myDataSource: {
          type: 'NONE',
        },
        myOtherDataSource: {
          type: 'NONE',
        },
      },
      resolvers: {
        'Query.getUser': {
          kind: 'UNIT',
          dataSource: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'getUser',
            },
          },
        },
        getUsers: {
          kind: 'UNIT',
          type: 'Query',
          field: 'getUsers',
          dataSource: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'getUsers',
            },
          },
        },
        'Mutation.createUser': {
          kind: 'PIPELINE',
          functions: [
            {
              dataSource: {
                type: 'AWS_LAMBDA',
                config: {
                  functionName: 'createUser',
                },
              },
            },
          ],
        },
      },
      pipelineFunctions: {
        function1: {
          dataSource: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'function1',
            },
          },
        },
        function2: {
          dataSource: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'function2',
            },
          },
        },
      },
    });
    expect(
      pick(config, ['dataSources', 'resolvers', 'pipelineFunctions']),
    ).toMatchSnapshot();
  });
});

describe('Resolvers', () => {
  it('should resolve resolver type and fields', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      resolvers: {
        'Query.getUser': {
          kind: 'UNIT',
          dataSource: 'users',
        },
        getUsersResolver: {
          type: 'Query',
          field: 'getUsers',
          kind: 'UNIT',
          dataSource: 'users',
        },
      },
    });
    expect(config.resolvers).toMatchSnapshot();
  });

  it('should merge resolvers arrays', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      resolvers: [
        {
          'Query.getUser': {
            kind: 'UNIT',
            dataSource: 'users',
          },
          getUsersResolver: {
            kind: 'UNIT',
            type: 'Query',
            field: 'getUsers',
            dataSource: 'users',
          },
          'Query.pipeline': {
            kind: 'PIPELINE',
            functions: ['function1', 'function2'],
          },
        },
        {
          'Query.getPost': {
            kind: 'UNIT',
            dataSource: 'posts',
          },
          getPostsResolver: {
            type: 'Query',
            kind: 'UNIT',
            field: 'getPosts',
            dataSource: 'posts',
          },
          pipelineResolver2: {
            kind: 'PIPELINE',
            functions: ['function1', 'function2'],
            type: 'Query',
            field: 'getUsers',
          },
        },
      ] satisfies Record<string, ResolverConfig>[],
    });
    expect(config.resolvers).toMatchSnapshot();
  });
});

describe('Pipeline Functions', () => {
  it('should merge function arrays', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,

      pipelineFunctions: [
        {
          function1: {
            dataSource: 'users',
          },
          function2: {
            dataSource: 'users',
          },
        },
        {
          function3: {
            dataSource: 'users',
          },
          function4: {
            dataSource: 'users',
          },
        },
      ],
    });
    expect(config.pipelineFunctions).toMatchSnapshot();
  });

  it('should merge inline function definitions', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      resolvers: {
        'Mutation.createUser': {
          kind: 'PIPELINE',
          functions: [
            {
              dataSource: 'users',
              code: 'function1.js',
            },
            {
              dataSource: 'users',
              code: 'function2.js',
            },
          ],
        },
        'Mutation.updateUser': {
          kind: 'PIPELINE',
          functions: [
            {
              code: 'updateUser.js',
              dataSource: {
                type: 'AWS_LAMBDA',
                config: {
                  functionName: 'updateUser',
                },
              },
            },
          ],
        },
      },
      pipelineFunctions: {
        function1: {
          dataSource: 'users',
        },
        function2: {
          dataSource: 'users',
        },
      },
    });
    expect(config.pipelineFunctions).toMatchSnapshot();
  });
});

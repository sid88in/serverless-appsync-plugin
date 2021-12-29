import { pick } from 'lodash';
import { getAppSyncConfig, ResolverConfigInput } from '../getAppSyncConfig';
import { basicConfig } from './basicConfig';

test('returns basic config', async () => {
  expect(getAppSyncConfig(basicConfig)).toMatchSnapshot();
});

describe('Schema', () => {
  it('should return the default schema', () => {
    expect(
      getAppSyncConfig({ ...basicConfig, schema: undefined }).schema,
    ).toMatchSnapshot();
  });

  it('should return a single schema as an array', () => {
    expect(
      getAppSyncConfig({ ...basicConfig, schema: 'mySchema.graphql' }).schema,
    ).toMatchSnapshot();
  });

  it('should return a schema array unchanged', () => {
    expect(
      getAppSyncConfig({
        ...basicConfig,
        schema: ['users.graphql', 'posts.graphql'],
      }).schema,
    ).toMatchSnapshot();
  });
});

describe('Api Keys', () => {
  it('should not generate a default Api Key when auth is not API_KEY', () => {
    expect(
      getAppSyncConfig({ ...basicConfig, authentication: { type: 'AWS_IAM' } })
        .apiKeys,
    ).toBeUndefined();
  });

  it('should generate api keys', () => {
    expect(
      getAppSyncConfig({
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
      }).apiKeys,
    ).toMatchInlineSnapshot(`
      Array [
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
          type: 'Query',
          field: 'getUsers',
          dataSource: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'getUsers',
            },
          },
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
    expect(pick(config, ['dataSources', 'resolvers'])).toMatchSnapshot();
  });
});

describe('Resolvers', () => {
  it('should resolve resolver type and fields', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      resolvers: {
        'Query.getUser': {
          dataSource: 'users',
        },
        getUsersResolver: {
          type: 'Query',
          field: 'getUsers',
          dataSource: 'users',
        },
        'Query.getPosts': 'posts',
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
            dataSource: 'users',
          },
          getUsersResolver: {
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
            dataSource: 'posts',
          },
          'Query.getComments': 'comments',
          getPostsResolver: {
            type: 'Query',
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
      ] as Record<string, ResolverConfigInput>[],
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
          function5: 'users',
        },
      ],
    });
    expect(config.pipelineFunctions).toMatchSnapshot();
  });
});

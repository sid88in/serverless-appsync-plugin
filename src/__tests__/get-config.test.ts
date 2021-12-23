import { getAppSyncConfig, ResolverConfigInput } from '../get-config';
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

describe('DataSources', () => {
  it('should resolve dataSource names', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      dataSources: {
        dataSourceWithName: {
          name: 'myDataSource',
          type: 'NONE',
        },
        myOtherDataSource: {
          type: 'NONE',
        },
      },
    });
    expect(config.dataSources).toMatchSnapshot();
  });

  it('should merge dataSource arrays', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      dataSources: [
        {
          dataSourceWithName: {
            name: 'myDataSource',
            type: 'NONE',
          },
          myOtherDataSource: {
            type: 'NONE',
          },
        },
        {
          otherSource: {
            name: 'otherNamedDs',
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
          'Query.getPosts': {
            dataSource: 'posts',
          },
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
  it('should resolve functions names', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,
      pipelineFunctions: {
        function1: {
          dataSource: 'users',
        },
        function2: {
          name: 'myFunction2',
          dataSource: 'users',
        },
      },
    });
    expect(config.pipelineFunctions).toMatchSnapshot();
  });

  it('should merge function arrays', async () => {
    const config = getAppSyncConfig({
      ...basicConfig,

      pipelineFunctions: [
        {
          function1: {
            dataSource: 'users',
          },
          function2: {
            name: 'myFunction2',
            dataSource: 'users',
          },
        },
        {
          function3: {
            dataSource: 'users',
          },
          function4: {
            name: 'myFunction4',
            dataSource: 'users',
          },
        },
      ],
    });
    expect(config.pipelineFunctions).toMatchSnapshot();
  });
});

import { synthesize } from './helpers/synthesize';
import { findResourcesByType } from './helpers/assertions';

describe('examples/sync-config-versioned', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/sync-config-versioned');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('emits SyncConfig with OPTIMISTIC_CONCURRENCY on updatePost resolver', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    const updatePost = resolvers.find(
      (r) =>
        r.resource.Properties?.TypeName === 'Mutation' &&
        r.resource.Properties?.FieldName === 'updatePost',
    );
    if (!updatePost) throw new Error('Mutation.updatePost resolver not found');
    const sync = updatePost.resource.Properties?.SyncConfig as Record<
      string,
      unknown
    >;
    expect(sync).toBeDefined();
    expect(sync.ConflictDetection).toBe('VERSION');
    expect(sync.ConflictHandler).toBe('OPTIMISTIC_CONCURRENCY');
  });

  it('emits SyncConfig with AUTOMERGE on mergePost resolver', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    const mergePost = resolvers.find(
      (r) =>
        r.resource.Properties?.TypeName === 'Mutation' &&
        r.resource.Properties?.FieldName === 'mergePost',
    );
    if (!mergePost) throw new Error('Mutation.mergePost resolver not found');
    const sync = mergePost.resource.Properties?.SyncConfig as Record<
      string,
      unknown
    >;
    expect(sync).toBeDefined();
    expect(sync.ConflictDetection).toBe('VERSION');
    expect(sync.ConflictHandler).toBe('AUTOMERGE');
  });

  it('marks the DynamoDB data source as versioned with delta sync config', () => {
    const dataSources = findResourcesByType(
      result.template,
      'AWS::AppSync::DataSource',
    );
    const posts = dataSources.find(
      (ds) => ds.resource.Properties?.Name === 'posts',
    );
    if (!posts) throw new Error('posts data source not found');
    const ddbConfig = posts.resource.Properties?.DynamoDBConfig as Record<
      string,
      unknown
    >;
    expect(ddbConfig).toBeDefined();
    // The plugin only emits Versioned: true when deltaSyncConfig is ALSO
    // provided — this fixture covers both together.
    expect(ddbConfig.Versioned).toBe(true);
    const delta = ddbConfig.DeltaSyncConfig as Record<string, unknown>;
    expect(delta).toBeDefined();
    expect(delta.BaseTableTTL).toBe(43200);
    expect(delta.DeltaSyncTableTTL).toBe(1440);
    expect(delta.DeltaSyncTableName).toBeDefined();
  });
});

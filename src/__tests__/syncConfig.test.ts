import { Api } from '../resources/Api';
import { SyncConfig } from '../resources/SyncConfig';
import { ResolverConfig } from '../types/plugin';
import * as given from './given';

const plugin = given.plugin();

describe('SyncConfig', () => {
  const baseResolver: ResolverConfig = {
    dataSource: 'myDataSource',
    kind: 'UNIT',
    type: 'Query',
    field: 'getThing',
  };

  it('returns undefined when no sync config is present', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const sync = new SyncConfig(api, baseResolver);

    expect(sync.compile()).toBeUndefined();
  });

  it('emits VERSION + OPTIMISTIC_CONCURRENCY by default when sync is enabled', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    // Pass an empty sync object — runtime defaults both conflictDetection and
    // conflictHandler. Casting through `unknown` because the public types
    // require both fields, but the runtime defensively defaults them.
    const sync = new SyncConfig(api, {
      ...baseResolver,
      sync: {} as unknown as ResolverConfig['sync'],
    });

    expect(sync.compile()).toEqual({
      ConflictDetection: 'VERSION',
      ConflictHandler: 'OPTIMISTIC_CONCURRENCY',
    });
  });

  it('honors an explicit conflictHandler value', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const sync = new SyncConfig(api, {
      ...baseResolver,
      sync: {
        conflictDetection: 'VERSION',
        conflictHandler: 'AUTOMERGE',
      } as unknown as ResolverConfig['sync'],
    });

    expect(sync.compile()).toEqual({
      ConflictDetection: 'VERSION',
      ConflictHandler: 'AUTOMERGE',
    });
  });

  it('emits only ConflictDetection when set to NONE (no handler)', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const sync = new SyncConfig(api, {
      ...baseResolver,
      sync: {
        conflictDetection: 'NONE',
      } as unknown as ResolverConfig['sync'],
    });

    expect(sync.compile()).toEqual({
      ConflictDetection: 'NONE',
    });
  });

  it('emits LambdaConflictHandlerConfig when conflictHandler is LAMBDA with a function ref', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const sync = new SyncConfig(api, {
      ...baseResolver,
      sync: {
        conflictDetection: 'VERSION',
        conflictHandler: 'LAMBDA',
        functionArn: 'arn:aws:lambda:us-east-1:123:function:resolver',
      } as unknown as ResolverConfig['sync'],
    });

    const result = sync.compile();
    expect(result).toMatchObject({
      ConflictDetection: 'VERSION',
      ConflictHandler: 'LAMBDA',
      LambdaConflictHandlerConfig: {
        LambdaConflictHandlerArn:
          'arn:aws:lambda:us-east-1:123:function:resolver',
      },
    });
  });

  it('emits LambdaConflictHandlerConfig when conflictHandler is LAMBDA with an inline function definition', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const sync = new SyncConfig(api, {
      ...baseResolver,
      sync: {
        conflictDetection: 'VERSION',
        conflictHandler: 'LAMBDA',
        function: {
          handler: 'index.handler',
        },
      },
    });

    // The exact ARN structure depends on the embedded-function naming, but the
    // outer envelope shape is what matters here.
    const result = sync.compile() as { [key: string]: unknown };
    expect(result.ConflictDetection).toBe('VERSION');
    expect(result.ConflictHandler).toBe('LAMBDA');
    expect(result.LambdaConflictHandlerConfig).toBeDefined();
  });
});

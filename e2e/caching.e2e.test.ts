import { synthesize } from './helpers/synthesize';
import {
  findOneResourceByType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/caching', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/caching');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates an ApiCache resource', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::AppSync::ApiCache',
    );
    const props = resource.Properties as Record<string, unknown>;
    expect(props.ApiCachingBehavior).toBe('PER_RESOLVER_CACHING');
    expect(props.Type).toBe('SMALL');
    expect(props.Ttl).toBe(600);
    expect(props.AtRestEncryptionEnabled).toBe(true);
    expect(props.TransitEncryptionEnabled).toBe(true);
  });

  it('configures caching keys on the resolver', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    expect(resolvers).toHaveLength(1);
    const props = resolvers[0].resource.Properties as Record<string, unknown>;
    const cacheConfig = props.CachingConfig as Record<string, unknown>;
    expect(cacheConfig).toBeDefined();
    expect(cacheConfig.Ttl).toBe(60);
    expect(cacheConfig.CachingKeys).toEqual([
      '$context.identity.username',
      '$context.arguments.id',
    ]);
  });
});

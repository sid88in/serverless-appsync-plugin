import { synthesize } from './helpers/synthesize';
import { getGraphQlApi } from './helpers/assertions';

describe('examples/introspection-disabled', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/introspection-disabled');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('disables introspection on the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.IntrospectionConfig).toBe('DISABLED');
  });

  it('enforces a query depth limit', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.QueryDepthLimit).toBe(10);
  });

  it('enforces a resolver count limit', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.ResolverCountLimit).toBe(50);
  });
});

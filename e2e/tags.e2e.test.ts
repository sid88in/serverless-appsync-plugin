import { synthesize } from './helpers/synthesize';
import { getGraphQlApi } from './helpers/assertions';

describe('examples/tags', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/tags');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('applies all configured tags to the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    const tags = resource.Properties?.Tags as Array<{
      Key: string;
      Value: unknown;
    }>;
    expect(Array.isArray(tags)).toBe(true);

    const tagMap: Record<string, unknown> = {};
    tags.forEach((t) => {
      tagMap[t.Key] = t.Value;
    });

    expect(tagMap.owner).toBe('platform-team');
    expect(tagMap['cost-center']).toBe('1234');
    expect(tagMap.project).toBe('my-product');
    expect(tagMap.environment).toBeDefined();
  });
});

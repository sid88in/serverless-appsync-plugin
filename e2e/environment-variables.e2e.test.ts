import { synthesize } from './helpers/synthesize';
import { getGraphQlApi } from './helpers/assertions';

describe('examples/environment-variables', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/environment-variables');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('passes environment variables to the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    const env = resource.Properties?.EnvironmentVariables as Record<
      string,
      string
    >;
    expect(env).toBeDefined();
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.FEATURE_FLAG_NEW_AUTH).toBe('true');
    expect(env.EXTERNAL_API_URL).toBe('https://api.example.com');
  });
});

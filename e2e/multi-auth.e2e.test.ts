import { synthesize } from './helpers/synthesize';
import { expectAuthenticationType, getGraphQlApi } from './helpers/assertions';

describe('examples/multi-auth', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/multi-auth');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('uses API_KEY as primary auth', () => {
    expectAuthenticationType(result.template, 'API_KEY');
  });

  it('lists all three additional auth providers on the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    const additional = resource.Properties
      ?.AdditionalAuthenticationProviders as Array<{
      AuthenticationType: string;
    }>;
    expect(additional).toBeDefined();
    expect(additional.map((p) => p.AuthenticationType).sort()).toEqual([
      'AMAZON_COGNITO_USER_POOLS',
      'AWS_IAM',
      'OPENID_CONNECT',
    ]);
  });

  it('still creates an API key (primary auth is API_KEY)', () => {
    const { template } = result;
    const apiKeys = Object.values(template.Resources).filter(
      (r) => r.Type === 'AWS::AppSync::ApiKey',
    );
    expect(apiKeys.length).toBeGreaterThanOrEqual(1);
  });
});

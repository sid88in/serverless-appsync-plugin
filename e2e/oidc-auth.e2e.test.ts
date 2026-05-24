import { synthesize } from './helpers/synthesize';
import { expectAuthenticationType, getGraphQlApi } from './helpers/assertions';

describe('examples/oidc-auth', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/oidc-auth');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('configures OPENID_CONNECT authentication', () => {
    expectAuthenticationType(result.template, 'OPENID_CONNECT');
  });

  it('passes OpenID Connect config to the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    const config = resource.Properties?.OpenIDConnectConfig as Record<
      string,
      unknown
    >;
    expect(config).toBeDefined();
    expect(config.Issuer).toBe('https://example.auth0.com/');
    expect(config.ClientId).toBe('my-client-id');
    expect(config.IatTTL).toBe(3600);
    expect(config.AuthTTL).toBe(3600);
  });
});

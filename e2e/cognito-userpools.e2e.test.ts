import { synthesize } from './helpers/synthesize';
import { expectAuthenticationType, getGraphQlApi } from './helpers/assertions';

describe('examples/cognito-userpools', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/cognito-userpools');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('configures AMAZON_COGNITO_USER_POOLS authentication', () => {
    expectAuthenticationType(result.template, 'AMAZON_COGNITO_USER_POOLS');
  });

  it('passes user pool config to the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    const config = resource.Properties?.UserPoolConfig as Record<
      string,
      unknown
    >;
    expect(config).toBeDefined();
    expect(config.DefaultAction).toBe('ALLOW');
    expect(config.AwsRegion).toBe('us-east-1');
    expect(config.UserPoolId).toBeDefined();
  });

  it('does not create an API key for non-API_KEY auth', () => {
    const { template } = result;
    const apiKeys = Object.values(template.Resources).filter(
      (r) => r.Type === 'AWS::AppSync::ApiKey',
    );
    expect(apiKeys).toHaveLength(0);
  });
});

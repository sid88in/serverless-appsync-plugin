import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  expectAuthenticationType,
  expectDataSourceOfType,
  expectResourceWithProperties,
  findOneResourceByType,
  getGraphQlApi,
} from './helpers/assertions';

describe('examples/basic-api-key', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/basic-api-key');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('produces a GraphQLApi with API_KEY authentication', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.Name).toBe('basic-api-key');
    expectAuthenticationType(result.template, 'API_KEY');
  });

  it('creates a default API key with the configured description', () => {
    expectResourceWithProperties(result.template, 'AWS::AppSync::ApiKey', {
      Description: 'Default API key',
    });
  });

  it('creates a GraphQLSchema bound to the API', () => {
    findOneResourceByType(result.template, 'AWS::AppSync::GraphQLSchema');
  });

  it('creates the DynamoDB data source with an IAM role', () => {
    const ds = expectDataSourceOfType(result.template, 'AMAZON_DYNAMODB');
    expect(ds.resource.Properties?.Name).toBe('users');
    // Each AppSync data source needs an IAM role so AppSync can read/write
    expect(
      countResourcesByType(result.template, 'AWS::IAM::Role'),
    ).toBeGreaterThan(0);
  });

  it('creates the Query.getUser resolver wired to the data source', () => {
    expectResourceWithProperties(result.template, 'AWS::AppSync::Resolver', {
      TypeName: 'Query',
      FieldName: 'getUser',
      Kind: 'UNIT',
    });
  });

  it('does not create any additional auth provider resources', () => {
    // API_KEY only — no Cognito, no Lambda authorizer
    const api = getGraphQlApi(result.template);
    expect(
      api.resource.Properties?.AdditionalAuthenticationProviders,
    ).toBeUndefined();
  });
});

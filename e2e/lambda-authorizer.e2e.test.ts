import { synthesize } from './helpers/synthesize';
import {
  expectAuthenticationType,
  findOneResourceByType,
  getGraphQlApi,
} from './helpers/assertions';

describe('examples/lambda-authorizer', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/lambda-authorizer');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('configures AWS_LAMBDA authentication', () => {
    expectAuthenticationType(result.template, 'AWS_LAMBDA');
  });

  it('passes the Lambda authorizer config to the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    const config = resource.Properties?.LambdaAuthorizerConfig as Record<
      string,
      unknown
    >;
    expect(config).toBeDefined();
    expect(config.AuthorizerResultTtlInSeconds).toBe(300);
    expect(config.IdentityValidationExpression).toBe('^Bearer .*');
    expect(config.AuthorizerUri).toBeDefined();
  });

  it('creates a Lambda function for the authorizer', () => {
    findOneResourceByType(result.template, 'AWS::Lambda::Function');
  });

  it('creates a Lambda invoke permission for AppSync', () => {
    findOneResourceByType(result.template, 'AWS::Lambda::Permission');
  });
});

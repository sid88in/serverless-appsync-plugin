import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  expectDataSourceOfType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/lambda-resolvers-js', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/lambda-resolvers-js');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates both DynamoDB and Lambda data sources', () => {
    expectDataSourceOfType(result.template, 'AMAZON_DYNAMODB');
    expectDataSourceOfType(result.template, 'AWS_LAMBDA');
  });

  it('creates all three resolvers', () => {
    expect(
      countResourcesByType(result.template, 'AWS::AppSync::Resolver'),
    ).toBe(3);
  });

  it('creates a JS resolver for Query.getUser', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    const getUser = resolvers.find(
      (r) =>
        r.resource.Properties?.TypeName === 'Query' &&
        r.resource.Properties?.FieldName === 'getUser',
    );
    if (!getUser) throw new Error('Query.getUser resolver not found');
    // JS resolver: has Runtime, Code property
    const props = getUser.resource.Properties as Record<string, unknown>;
    expect(props.Runtime).toEqual({
      Name: 'APPSYNC_JS',
      RuntimeVersion: '1.0.0',
    });
    expect(props.Code).toBeDefined();
  });

  it('creates a VTL-default resolver for Mutation.createUser (no code, no runtime)', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    const createUser = resolvers.find(
      (r) =>
        r.resource.Properties?.TypeName === 'Mutation' &&
        r.resource.Properties?.FieldName === 'createUser',
    );
    if (!createUser) throw new Error('Mutation.createUser resolver not found');
    const props = createUser.resource.Properties as Record<string, unknown>;
    expect(props.Runtime).toBeUndefined();
  });

  it('creates IAM roles for each data source (DynamoDB + Lambda)', () => {
    // 2 data source roles minimum
    expect(
      countResourcesByType(result.template, 'AWS::IAM::Role'),
    ).toBeGreaterThanOrEqual(2);
  });

  it('creates a Lambda function for the createUser handler', () => {
    expect(
      countResourcesByType(result.template, 'AWS::Lambda::Function'),
    ).toBeGreaterThanOrEqual(1);
  });
});

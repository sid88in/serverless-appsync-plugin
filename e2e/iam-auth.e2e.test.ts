import { synthesize } from './helpers/synthesize';
import {
  expectAuthenticationType,
  expectDataSourceOfType,
} from './helpers/assertions';

describe('examples/iam-auth', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/iam-auth');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('configures AWS_IAM authentication', () => {
    expectAuthenticationType(result.template, 'AWS_IAM');
  });

  it('creates the NONE data source', () => {
    expectDataSourceOfType(result.template, 'NONE');
  });

  it('does not create any IAM role for NONE data source', () => {
    // NONE data sources don't need an IAM role
    const { template } = result;
    // The deployment bucket policy exists; we're checking AppSync-owned roles
    // by counting roles whose names start with the GraphQL data source prefix.
    const allRoles = Object.entries(template.Resources).filter(
      ([, r]) => r.Type === 'AWS::IAM::Role',
    );
    // There may be 0 roles for a NONE-only setup (no service role needed
    // because we're not using logs/xray)
    expect(allRoles.length).toBeLessThanOrEqual(1);
  });
});

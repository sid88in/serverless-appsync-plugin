import { synthesize } from './helpers/synthesize';
import {
  expectDataSourceOfType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/datasource-bedrock', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/datasource-bedrock');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates an AMAZON_BEDROCK_RUNTIME data source', () => {
    const ds = expectDataSourceOfType(
      result.template,
      'AMAZON_BEDROCK_RUNTIME',
    );
    expect(ds.resource.Properties?.Name).toBe('bedrock');
  });

  it('generates a service role with bedrock:InvokeModel permissions', () => {
    const roles = findResourcesByType(result.template, 'AWS::IAM::Role');
    const bedrockRole = roles.find(({ resource }) => {
      const policies = resource.Properties?.Policies as Array<{
        PolicyDocument?: { Statement?: Array<{ Action?: string[] }> };
      }>;
      return policies?.some((policy) =>
        policy.PolicyDocument?.Statement?.some((statement) =>
          statement.Action?.includes('bedrock:InvokeModel'),
        ),
      );
    });

    expect(bedrockRole).toBeDefined();
  });
});

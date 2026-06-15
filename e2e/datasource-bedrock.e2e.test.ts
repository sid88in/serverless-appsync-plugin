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

  it('generates a service role with bedrock invoke permissions for the datasource', () => {
    const ds = expectDataSourceOfType(
      result.template,
      'AMAZON_BEDROCK_RUNTIME',
    );
    const serviceRoleArn = ds.resource.Properties?.ServiceRoleArn as {
      'Fn::GetAtt'?: [string, string];
    };
    const roleLogicalId = serviceRoleArn?.['Fn::GetAtt']?.[0];
    expect(roleLogicalId).toBeDefined();

    const roles = findResourcesByType(result.template, 'AWS::IAM::Role');
    const bedrockRole = roles.find(
      ({ logicalId }) => logicalId === roleLogicalId,
    );
    expect(bedrockRole).toBeDefined();

    const policies = bedrockRole!.resource.Properties?.Policies as Array<{
      PolicyName?: string;
      PolicyDocument?: { Statement?: Array<{ Action?: string | string[] }> };
    }>;
    expect(policies?.[0]?.PolicyName).toBe('AppSync-Datasource-bedrock');

    const actions =
      policies?.flatMap(
        (policy) =>
          policy.PolicyDocument?.Statement?.flatMap((statement) =>
            Array.isArray(statement.Action)
              ? statement.Action
              : statement.Action
              ? [statement.Action]
              : [],
          ) ?? [],
      ) ?? [];

    expect(actions).toEqual(
      expect.arrayContaining(['bedrock:InvokeModel', 'bedrock:Converse']),
    );
  });
});

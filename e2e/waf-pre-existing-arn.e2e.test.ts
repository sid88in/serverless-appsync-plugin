import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findOneResourceByType,
} from './helpers/assertions';

describe('examples/waf-pre-existing-arn', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/waf-pre-existing-arn');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('does NOT create an AWS::WAFv2::WebACL resource (uses pre-existing)', () => {
    expect(countResourcesByType(result.template, 'AWS::WAFv2::WebACL')).toBe(0);
  });

  it('creates an AWS::WAFv2::WebACLAssociation pointing at the imported ARN', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::WAFv2::WebACLAssociation',
    );
    const props = resource.Properties as Record<string, unknown>;
    expect(props.ResourceArn).toBeDefined();

    // WebACLArn is the user-provided intrinsic, faithfully preserved
    const webAclArn = props.WebACLArn as Record<string, unknown>;
    expect(webAclArn['Fn::ImportValue']).toBe('SharedWafAclArn');
  });
});

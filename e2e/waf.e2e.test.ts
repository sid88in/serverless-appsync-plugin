import { synthesize } from './helpers/synthesize';
import { findOneResourceByType } from './helpers/assertions';

describe('examples/waf', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/waf');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates a WAFv2 WebACL', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::WAFv2::WebACL',
    );
    const props = resource.Properties as Record<string, unknown>;
    expect(props.Name).toBe('AppSyncWaf');
    expect(props.Scope).toBe('REGIONAL');
    expect(props.DefaultAction).toEqual({ Allow: {} });
  });

  it('attaches the WebACL to the GraphQL API', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::WAFv2::WebACLAssociation',
    );
    const props = resource.Properties as Record<string, unknown>;
    expect(props.ResourceArn).toBeDefined();
    expect(props.WebACLArn).toBeDefined();
  });

  it('builds rules from the shorthand syntax (throttle + disableIntrospection + custom)', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::WAFv2::WebACL',
    );
    const rules = (resource.Properties as Record<string, unknown>)
      .Rules as Array<Record<string, unknown>>;
    expect(rules.length).toBeGreaterThanOrEqual(3);
    // Find at least one rule that's clearly the disableIntrospection one
    const introspectionRule = rules.find((r) =>
      JSON.stringify(r).toLowerCase().includes('introspect'),
    );
    expect(introspectionRule).toBeDefined();
    // Find the throttle rule by RateBasedStatement
    const throttleRule = rules.find((r) => {
      const stmt = r.Statement as Record<string, unknown> | undefined;
      return stmt?.RateBasedStatement !== undefined;
    });
    expect(throttleRule).toBeDefined();
  });
});

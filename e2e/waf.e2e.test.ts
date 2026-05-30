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

  it('omits EvaluationWindowSec for a throttle rule that does not set it', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::WAFv2::WebACL',
    );
    const rules = (resource.Properties as Record<string, unknown>)
      .Rules as Array<Record<string, unknown>>;
    // The `throttle: 200` shorthand rule sets no evaluationWindowSec, so the
    // synthesized template must NOT contain the property (AWS applies its own
    // default of 300). This guards against template churn for existing stacks.
    const defaultThrottle = rules.find((r) => {
      const stmt = (r.Statement as Record<string, unknown>)
        ?.RateBasedStatement as Record<string, unknown> | undefined;
      return stmt?.Limit === 200;
    });
    expect(defaultThrottle).toBeDefined();
    const stmt = (defaultThrottle!.Statement as Record<string, unknown>)
      .RateBasedStatement as Record<string, unknown>;
    expect('EvaluationWindowSec' in stmt).toBe(false);
  });

  it('emits EvaluationWindowSec when explicitly configured', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::WAFv2::WebACL',
    );
    const rules = (resource.Properties as Record<string, unknown>)
      .Rules as Array<Record<string, unknown>>;
    // The object-form throttle rule sets evaluationWindowSec: 60 explicitly.
    const forwarded = rules.find((r) => {
      const stmt = (r.Statement as Record<string, unknown>)
        ?.RateBasedStatement as Record<string, unknown> | undefined;
      return stmt?.AggregateKeyType === 'FORWARDED_IP';
    });
    expect(forwarded).toBeDefined();
    const stmt = (forwarded!.Statement as Record<string, unknown>)
      .RateBasedStatement as Record<string, unknown>;
    expect(stmt.EvaluationWindowSec).toBe(60);
    expect(stmt.Limit).toBe(100);
  });
});

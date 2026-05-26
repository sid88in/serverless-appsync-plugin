import { synthesize } from './helpers/synthesize';
import { findResourcesByType } from './helpers/assertions';

describe('examples/substitutions', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/substitutions');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('renders substitution variables as Fn::Sub blocks inside the template', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    expect(resolvers).toHaveLength(1);
    const props = resolvers[0].resource.Properties as Record<string, unknown>;

    // The plugin produces a Fn::Join that interleaves the static template
    // strings with per-variable Fn::Sub blocks. Verify both substitution
    // variables appear inside the joined output, and that the TABLE_NAME
    // ref to the UsersTable CloudFormation resource is preserved.
    const reqTemplate = props.RequestMappingTemplate;
    const serialized = JSON.stringify(reqTemplate);

    expect(serialized).toContain('Fn::Join');
    expect(serialized).toContain('Fn::Sub');
    expect(serialized).toContain('TABLE_NAME');
    expect(serialized).toContain('ENVIRONMENT');
    expect(serialized).toContain('UsersTable');
  });
});

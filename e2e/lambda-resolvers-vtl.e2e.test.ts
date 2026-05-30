import { synthesize } from './helpers/synthesize';
import { findResourcesByType } from './helpers/assertions';

describe('examples/lambda-resolvers-vtl', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/lambda-resolvers-vtl');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates a resolver with VTL request and response mapping templates', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    expect(resolvers).toHaveLength(1);
    const props = resolvers[0].resource.Properties as Record<string, unknown>;

    // VTL resolvers have RequestMappingTemplate and ResponseMappingTemplate strings
    expect(props.RequestMappingTemplate).toBeDefined();
    expect(props.ResponseMappingTemplate).toBeDefined();

    // VTL request templates start with `{` and contain the version field
    const reqTemplate = props.RequestMappingTemplate as string;
    expect(reqTemplate).toContain('"operation": "GetItem"');

    // No Code field for VTL-mode resolvers
    expect(props.Code).toBeUndefined();
    expect(props.Runtime).toBeUndefined();
  });
});

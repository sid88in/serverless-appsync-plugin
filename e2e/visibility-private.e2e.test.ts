import { synthesize } from './helpers/synthesize';
import { getGraphQlApi } from './helpers/assertions';

describe('examples/visibility-private', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/visibility-private');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('sets the GraphQLApi visibility to PRIVATE', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.Visibility).toBe('PRIVATE');
  });

  it('uses AWS_IAM authentication (required for PRIVATE APIs)', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.AuthenticationType).toBe('AWS_IAM');
  });
});

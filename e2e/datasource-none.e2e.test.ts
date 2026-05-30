import { synthesize } from './helpers/synthesize';
import { expectDataSourceOfType } from './helpers/assertions';

describe('examples/datasource-none', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/datasource-none');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates a NONE data source', () => {
    const ds = expectDataSourceOfType(result.template, 'NONE');
    expect(ds.resource.Properties?.Name).toBe('noop');
  });

  it('does NOT create a service role for the NONE data source', () => {
    // NONE data sources don't make AWS calls so they don't need a role.
    const ds = expectDataSourceOfType(result.template, 'NONE');
    expect(ds.resource.Properties?.ServiceRoleArn).toBeUndefined();
  });
});

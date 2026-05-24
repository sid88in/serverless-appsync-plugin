import { synthesize } from './helpers/synthesize';
import { expectDataSourceOfType } from './helpers/assertions';

describe('examples/datasource-opensearch', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/datasource-opensearch');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates an AMAZON_OPENSEARCH_SERVICE data source', () => {
    expectDataSourceOfType(result.template, 'AMAZON_OPENSEARCH_SERVICE');
  });

  it('configures the OpenSearch endpoint', () => {
    const ds = expectDataSourceOfType(
      result.template,
      'AMAZON_OPENSEARCH_SERVICE',
    );
    const osConfig = ds.resource.Properties?.OpenSearchServiceConfig as Record<
      string,
      unknown
    >;
    expect(osConfig).toBeDefined();
    expect(osConfig.Endpoint).toBeDefined();
  });
});

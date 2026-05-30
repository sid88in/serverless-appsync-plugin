import { synthesize } from './helpers/synthesize';
import { expectDataSourceOfType } from './helpers/assertions';

describe('examples/datasource-rds', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/datasource-rds');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates a RELATIONAL_DATABASE data source', () => {
    expectDataSourceOfType(result.template, 'RELATIONAL_DATABASE');
  });

  it('configures the RDS HTTP endpoint with cluster + secret ARNs', () => {
    const ds = expectDataSourceOfType(result.template, 'RELATIONAL_DATABASE');
    const rdsConfig = ds.resource.Properties
      ?.RelationalDatabaseConfig as Record<string, unknown>;
    expect(rdsConfig).toBeDefined();
    expect(rdsConfig.RelationalDatabaseSourceType).toBe('RDS_HTTP_ENDPOINT');

    const httpEndpoint = rdsConfig.RdsHttpEndpointConfig as Record<
      string,
      unknown
    >;
    expect(httpEndpoint.DatabaseName).toBe('orders');
    expect(httpEndpoint.DbClusterIdentifier).toBeDefined();
    expect(httpEndpoint.AwsSecretStoreArn).toBeDefined();
  });
});

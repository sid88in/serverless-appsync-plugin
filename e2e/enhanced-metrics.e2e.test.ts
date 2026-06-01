import { synthesize } from './helpers/synthesize';
import {
  getGraphQlApi,
  findResourcesByType,
  expectResourceWithProperties,
} from './helpers/assertions';

describe('examples/enhanced-metrics', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/enhanced-metrics');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('emits a complete EnhancedMetricsConfig on the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.EnhancedMetricsConfig).toEqual({
      DataSourceLevelMetricsBehavior: 'PER_DATA_SOURCE_METRICS',
      OperationLevelMetricsConfig: 'ENABLED',
      ResolverLevelMetricsBehavior: 'PER_RESOLVER_METRICS',
    });
  });

  it('defaults a resolver MetricsConfig to DISABLED', () => {
    // Query.hello does not set metricsConfig
    expectResourceWithProperties(result.template, 'AWS::AppSync::Resolver', {
      FieldName: 'hello',
      MetricsConfig: 'DISABLED',
    });
  });

  it('honors a per-resolver metricsConfig override', () => {
    // Query.user sets metricsConfig: ENABLED
    expectResourceWithProperties(result.template, 'AWS::AppSync::Resolver', {
      FieldName: 'user',
      MetricsConfig: 'ENABLED',
    });
  });

  it('emits MetricsConfig on every resolver when enhanced metrics are enabled', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    expect(resolvers.length).toBeGreaterThanOrEqual(2);
    for (const { resource } of resolvers) {
      expect(resource.Properties?.MetricsConfig).toBeDefined();
    }
  });
});

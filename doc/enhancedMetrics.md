# Enhanced Metrics

AppSync supports [Enhanced metrics](https://docs.aws.amazon.com/appsync/latest/devguide/monitoring.html#cw-metrics). You can configure them under the `appSync.enhancedMetrics` attribute.

## Quick start

```yaml
appSync:
  name: my-api
  enhancedMetrics:
    DataSourceLevelMetricsBehavior: 'FULL_REQUEST_DATA_SOURCE_METRICS'
    OperationLevelMetricsConfig: 'ENABLED'
    ResolverLevelMetricsBehavior: 'PER_RESOLVER_METRICS'
```

## Configuration

All three properties are required by AWS. See the [official documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-graphqlapi-enhancedmetricsconfig.html) for details.

- `DataSourceLevelMetricsBehavior`: `FULL_REQUEST_DATA_SOURCE_METRICS` | `PER_DATA_SOURCE_METRICS`
- `OperationLevelMetricsConfig`: `ENABLED` | `DISABLED`
- `ResolverLevelMetricsBehavior`: `FULL_REQUEST_RESOLVER_METRICS` | `PER_RESOLVER_METRICS`

## Per-resolver metrics

When `ResolverLevelMetricsBehavior` is `PER_RESOLVER_METRICS`, AppSync only emits metrics for resolvers whose `MetricsConfig` is `ENABLED`. Set this per resolver with `metricsConfig`:

```yaml
appSync:
  resolvers:
    Query.user:
      kind: UNIT
      dataSource: my_table
      metricsConfig: 'ENABLED'
```

`metricsConfig` defaults to `DISABLED` and is only emitted into the generated CloudFormation when `enhancedMetrics` is configured, so existing stacks that don't use enhanced metrics are unaffected. With `FULL_REQUEST_RESOLVER_METRICS`, metrics are emitted for all resolvers regardless of `metricsConfig`.

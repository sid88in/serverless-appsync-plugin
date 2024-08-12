# Enhanced Metrics

AppSync supports [Enhanced metrics](https://docs.aws.amazon.com/appsync/latest/devguide/monitoring.html#cw-metrics). You can find the metrics  configuration under the `appSync.enhancedMetrics` attribute.

## Quick start

```yaml
appSync:
  name: my-api
  enhancedMetrics:
    DataSourceLevelMetricsBehavior: 'FULL_REQUEST_DATA_SOURCE_METRICS'
    OperationLevelMetricsConfig: 'ENABLED'
```

## Configuration
See [official documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-graphqlapi-enhancedmetricsconfig.html).

Note `ResolverLevelMetricsBehavior` is fixed to `PER_RESOLVER_METRICS` with each resolver's `MetricsConfig` set to `DISABLED`

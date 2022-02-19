# Pipeline functions

When you use `PIPELINE` [resolvers](resolvers.md), you will also need to define the used pipeline functions. You can do so under the `appSync.pipelineFunctions` attribute.

It's a key-value pair object whose key is the name of the function and the value is its configuration.

The definition can also be a string in which case it's the [dataSource](dataSources.md) name to use. The other attributes use the default values.

## Quick start

```yaml
appSync:
  pipelineFunctions:
    myFunction: myDataSource
    myOtherFunction:
      dataSource: myOtherDataSource
```

## Configutation

- `dataSource`: The name of the dataSource to use.
- `description`: An optional description for this pipeline function.
- `request`: The request mapping template file name to use for this resolver, or `false` for [direct lambda](https://docs.aws.amazon.com/appsync/latest/devguide/direct-lambda-reference.html). Defaults to `{functionName}.request.vtl`.
- `response`: The request mapping template file name to use for this resolver, or `false` for [direct lambda](https://docs.aws.amazon.com/appsync/latest/devguide/direct-lambda-reference.html). Defaults to `{functionName}.response.vtl`.
- `maxBatchSize`: The maximum [batch size](https://aws.amazon.com/blogs/mobile/introducing-configurable-batching-size-for-aws-appsync-lambda-resolvers/) to use (only available for AWS Lambda DataAources)
- `substitutions`: See [VTL template substitutions](substitutions.md)
- `sync`: [See SyncConfig](syncConfig.md)

## Inline DataSources

Just like with `UNIT` resolvers, you can [define the dataSource inline](resolvers.md#inline-datasources) in pipeline functions.

```yaml
appSync:
  pipelineFunctions:
    myFunction:
      dataSource:
        type: 'AWS_LAMBDA'
        config:
          function:
            timeout: 30
            handler: 'functions/myFunction.handler'
```

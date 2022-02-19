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
- `sync`: [See blow](#Sync)

## Sync

The [Delta Sync](https://docs.aws.amazon.com/appsync/latest/devguide/tutorial-delta-sync.html) configuration for this pipeline function.

```yaml
Query.user:
  dataSource: my-table
  sync:
    conflictDetection: 'VERSION'
    conflictHandler: 'LAMBDA'
    function:
      timeout: 30
      handler: 'functions/userSync.handler'
```

- `conflictDetection`: `VERSION` or `NONE`. Defaults to `VERSION`
- `conflictHandler`: `OPTIMISTIC_CONCURRENCY`, `AUTOMERGE` or `LAMBDA`. Defaults to `OPTIMISTIC_CONCURRENCY`
- `function`: When `conflictHandler` is `LAMBDA`, a Lambda function definition as you would define it under the `functions` section of your `serverless.yml` file.
- `functionName`: When `conflictHandler` is `LAMBDA`, the name of the function as defined under the `functions` section of the `serverless.yml` file
- `functionAlias`: When `conflictHandler` is `LAMBDA`, a specific function alias to use.
- `functionArn`: When `conflictHandler` is `LAMBDA`, the function ARN to use.

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

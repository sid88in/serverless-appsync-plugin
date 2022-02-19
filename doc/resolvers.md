# Resolvers

All the Resolvers in your AppSync API can be found in serverless.yml under the `appSync.resolvers` property.

Resolvers are defined using key-value pairs where the key can either be an arbitrary name for the resolver or the `type` and `field` in the schema it is attached to separated with a dot (`.`), and the value is the configuration of the resolver.

The definition can also be a string in which case it's the [dataSource](dataSources.md) name to use. The other attributes use the default values.

## Quick start

```yaml
appSync:
  resolvers:
    Query.user:
      dataSource: myDataSource

    Query.users: myDataSource

    getPosts:
      type: Query
      field: getPosts
      dataSource: myDataSource
```

## Configuration

- `type`: The Type in the schema this resolver is attached to. Optional if specified in the configuration key.
- `field`: The Field in the schema this resolver is attached to. Optional if specified in the configuration key.
- `kind`: The kind of resolver. Can be `UNIT` or `PIPELINE` ([see below](#PIPELINE-resolvers)). Defaults to `UNIT`
- `dataSource`: The name of the [dataSource](dataSources.md) this resolver uses.
- `maxBatchSize`: The maximum [batch size](https://aws.amazon.com/blogs/mobile/introducing-configurable-batching-size-for-aws-appsync-lambda-resolvers/) to use (only available for AWS Lambda DataSources)
- `request`: The request mapping template file name to use for this resolver, or `false` for [direct lambda](https://docs.aws.amazon.com/appsync/latest/devguide/direct-lambda-reference.html). Defaults to `{type}.{field}.request.vtl`.
- `response`: The request mapping template file name to use for this resolver, or `false` for [direct lambda](https://docs.aws.amazon.com/appsync/latest/devguide/direct-lambda-reference.html). Defaults to `{type}.{field}.response.vtl`.
- `substitutions`: See [VTL template substitutions](substitutions.md)
- `caching`: [See below](#Caching)
- `sync`: [See blow](#Sync)

## PIPELINE resolvers

When `kind` is `PIPELINE`, you can specify the [pipeline function](pipeline-functions.md) names to use:

```yaml
appSync:
  pipelineFunctions:
    function1:
      dataSource: myDataSource
    function2:
      dataSource: myDataSource

  resolvers:
    Query.user:
      dataSource: my-table
      functions:
        - function1
        - function2
```

## Inline DataSources

If a [DataSource](dataSources.md) is only used in one single resolver, you can also define it inline in the resolver configuration. This is often the case for Lambda resolvers.

You can even also define the Lambda function definition inline under the dataSource definition. This helps keep everything in one single place!

```yaml
appSync:
  resolvers:
    Query.user:
      dataSource:
        type: 'AWS_LAMBDA'
        config:
          function:
            timeout: 30
            handler: 'functions/getUser.handler'
```

## Caching

```yaml
Query.user:
  dataSource: myDataSource
  caching:
    ttl: 60
    keys:
      - '$ctx.arguments.id'
```

You can either pass `true` which will use the global TTL (See the [global caching configuration](caching.md)) and no `keys`.

You can also customize each resolver using the following config:

- `ttl`: The TTL of the cache for this resolver in seconds
- `keys`: An array of keys to use for the cache.

## Sync

The [Delta Sync](https://docs.aws.amazon.com/appsync/latest/devguide/tutorial-delta-sync.html) configuration for this resolver.

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

# Organize your resolvers

You can define your data sources into several files for organizational reasons. You can pass each file into the `dataSources` attribute as an array.

```yaml
resolvers:
  - ${file(appsync/resolvers/users.yml)}
  - ${file(appsync/resolvers/posts.yml)}
```

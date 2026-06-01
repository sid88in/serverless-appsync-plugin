# Caching

AppSync supports [server-side data caching](https://docs.aws.amazon.com/appsync/latest/devguide/enabling-caching.html). You can find the caching configuration under the `appSync.caching` attribute.

## Quick start

```yaml
appSync:
  name: my-api
  caching:
    behavior: 'PER_RESOLVER_CACHING'
    type: 'SMALL'
    ttl: 3600
    atRestEncryption: false
    transitEncryption: false
```

## Configuration

- `behavior`: `FULL_REQUEST_CACHING` or `PER_RESOLVER_CACHING`
- `type`: The type of the Redis instance. `SMALL`, `MEDIUM`, `LARGE`, `XLARGE`, `LARGE_2X`, `LARGE_4X`, `LARGE_8X`, `LARGE_12X`. Defaults to `SMALL`
- `ttl`: The default TTL of the cache in seconds. Defaults to `3600`. Maximum is `3600`
- `enabled`: Boolean. Whether caching is enabled. Defaults to `true` when the `caching` definition is present.
- `atRestEncryption`: Boolean. Whether to encrypt the data at rest. Defaults to `false`
- `transitEncryption`: Boolean. Whether to encrypt the data in transit. Defaults to `false`

## Per resolver caching

See [Resolver caching](resolvers.md#caching)

## Evicting items from the cache

To evict a single entry from the cache (rather than flushing everything), use AppSync's [`evictFromApiCache`](https://docs.aws.amazon.com/appsync/latest/devguide/extensions.html) extension from within a resolver. This is a runtime feature of AppSync, so there is nothing special to configure in this plugin: just call it from the mapping template or JavaScript code of the resolver, and it is passed through to AppSync as-is.

A few things to keep in mind (see the [AppSync docs](https://docs.aws.amazon.com/appsync/latest/devguide/enabling-caching.html) for the details):

- It only works in **mutation** resolvers, not queries.
- The target entry is identified by the type name, field name, and a map of caching keys. The keys must match — in the same order — the `keys` of the cached resolver you want to evict.

For example, given a cached query resolver:

```yaml
appSync:
  resolvers:
    Query.getNote:
      dataSource: notes
      caching:
        ttl: 60
        keys:
          - '$context.arguments.id'
```

You can evict its cached entry from a mutation resolver. With a VTL response template:

```vtl
#set($keys = {})
$util.qr($keys.put("context.arguments.id", $ctx.args.id))
$extensions.evictFromApiCache("Query", "getNote", $keys)
$util.toJson($ctx.result)
```

Or with a JavaScript resolver:

```js
import { extensions } from '@aws-appsync/utils';

export function response(ctx) {
  extensions.evictFromApiCache('Query', 'getNote', {
    'context.arguments.id': ctx.args.id,
  });
  return ctx.result;
}
```

## Flushing the cache

You can use the [flush-cache command](commands.md#flush-cache) to easily flush the cache.

# Upgrading from v1 to v2

`v2` of this plugin tries to keep backward compatibility with `v1` from a CloudFormation perspective (i.e. Logical names are maintained). This pretends to make migration from `v1` possible. However, the API has changed quite a bit.

This page will guide you through the process of migrating existing stacks to the newer version.

The v1 is still available on the [v1](https://github.com/sid88in/serverless-appsync-plugin/tree/v1) branch

⚠️ Using the AppSync API keys? Read about the [API keys rotation issue](#api-keys-rotation-issue)

## Breaking changes and dropped features

There are a few breaking changes that you need to be aware of.

### API keys rotation issue

Due to a [backwards-compatibility issue](https://github.com/sid88in/serverless-appsync-plugin/issues/584) your API keys will get rotated
(changed) upon the first deployment with the `v2` version of this plugin. If left unresolved, this will cause your clients that use the keys
to break, until you are able to update them with the newly generated API keys. 
Make sure to read about [mitigating the API key rotation issue](#mitigate-the-api-key-rotation-issue)

### Support for Serverless Framework v3 only

`v2` only supports the new [Serverless Framework v3](https://www.serverless.com/blog/serverless-framework-v3-is-live). You will need to upgrade to [SF v3 first](https://www.serverless.com/framework/docs/guides/upgrading-v3).

### Single API only

Support for multiple APIs has been dropped in v2. There are several reasons for this:

- **It was an edge case**: Most users would only have one API per Stack
- **It is probably bad practice**: Different APIs should be considered different micro-services and be deployed separately.
- **It is not supported by the Serverless Framework for API Gateway**: SF does not support multiple API Gateways in a single Stack. Why should this plugin do for AppSync?

If you only have one API in your current stack, you should not worry about this change. You do need to make sure that you do not define your `appSync` API as an array (even with one element only), though.

```yaml
custom:
  appSync:
    name: my-api # ✅ Compatible with v2

  appSync:
    - name: my-api # ❌ Incompatible with v2
```

**Workaround**

Place your APIs into different stacks. Unfortunately, this WILL require **the replacement of the APIs**. You can probably use [custom domains](custom-domain.md) to workaround that, if that's an option.

### Defaults to PIPELINE and JavaScript resolvers

The new default runtime is JavaScript.

The new default `KIND` for resolvers is `PIPELINE`. For several reasons:

- The JavaScript runtime, is only supported with PIPELINE resolvers
- It makes migrations easier later, if you need to add functions to your resolvers.

> 💡 To simulate a UNIT resolver, use a PIPELINE with only one function.

```yml
resolvers:
  Query.getPost:
    functions:
      - dataSource: posts
        code: resolvers/getPost.js
```

### No more defaults for resolver handler paths.

In `v1`, if you did not specify a path to your mapping templates, a default based on the type, field or function name was used. (e.g. `Query.getPost.request.vtl`).

To avoid unexpected behaviours, you are now required to explicitly specify the path to your resolver handlers. i.e. use `code` for Pipeline JS resolvers or `request`/`response` for VTL.

There is also no more `mappingTemplatesLocation` option. Paths must be relative to the `serverless.yml`. This aligns more with how Serverless Framework handles Lambda function handlers' paths.

### Graphql "playground"

The `graphql-playground` command which started a graphiql server pointing to the AppSync API has been removed.

**Workaround**

Use other solutions such as [Insomnia](https://insomnia.rest/), or [Postman](https://www.postman.com/)

### Support for existing APIs

`v1` offered a way to define some resource such as DataSources, Resolvers, etc. on an existing API (that was previously created using other mechanisms, for example manually). `v2` does no longer offer that possibility. It adds complexity, can behave unexpectedly and is probably a bad practice too. Prefer defining your whole API under the same stack.

**Workaround**

Define your API completely in the same stack. This might require **the replacement of the API**. You can use [custom domains](custom-domain.md) to workaround that, if that's an option.

### Output variables

`v1` exported some values to the stack Output by default. This is no longer the case. Instead, prefer using the new exported [variables](../README.md#variables).

**Workaround**

You still can export those values if you want but you'll have to do it explicitly yourself:

```yaml
resources:
  Outputs:
    GraphQlApiUrl:
      Value: ${appsync:url}
```

## Upgrade instructions

⚠️ This guide tries to give instructions as clear as possible on how to upgrade from `v1` to `v2`. But, please note that there is **no guarantee** that everything will keep working as expected. Each case is unique and this guide might miss some subtilities that are applicable to you only. It is your responsibility to test your changes and check that they don't break your stack (e.g. in a dev/test environment).

📚 I also strongly advice that you get familiar with [the new API](general-config.md) first as most changes will probably be obvious and straight forward. Check the documentation for every feature you are using to see if and how they have changed.

💡 `v2` now validates the configuration. If anything is wrong, you should get a warning. I recommend that you enable the [service configuration validation](https://www.serverless.com/framework/docs/configuration-validation) in your `serverless.yml` and set it to `error`. Note that this does not guarantee to catch all the issues.

```yaml
service: my-app

configValidationMode: error
```

🙋‍♂️ If you find information that is inaccurate or incomplete in this guide, please [open a PR](https://github.com/sid88in/serverless-appsync-plugin/compare) to fix it 🙏.

#### Path of the appSync configuration

The first significant change is that you must now define your API under the `appSync` attribute directly at the root of your `serverless.yml` file, as opposed to placing it under `custom` in `v1`.

Just move your configuration up one level.

Example:

```yaml
custom:
  appSync:
    name: my-api
```

becomes

```yaml
appSync:
  name: my-api
```

#### Renamed attributes

Some attributes have been renamed for clarity. Here are the most important ones.

- rename `mappingTemplates` to `resolvers`
- rename `functionConfigurations` to `pipelineFunctions`
- rename `logConfig` to `logging`
- rename `wafConfig` to `waf`

#### DataSources

[DataSources](dataSources.md) are now defined as a key-value pair object. In `v1`, you passed them as an array. Replace the array with a key-value pair object where the key is what you used to have under `name`.

Example

```yaml
dataSources:
  - type: AMAZON_DYNAMODB
      name: myDatasource
      config:
        tableName: my-table
```

becomes:

```yaml
dataSources:
  myDatasource:
    type: AMAZON_DYNAMODB
    config:
      tableName: my-table
```

#### Resolvers

[Resolvers](resolvers.md) are now defined as a key-value pair object. In `v1` you passed them as an array. Replace the array with a key-value pair object. You can use any value as the key, or use the [`Type.field` shortcut](resolvers.md).

Also rename `mappingTemplates` to `resolvers`

Example:

```yaml
mappingTemplates:
  - type: Query
    field: getUser
    dataSource: myDataSource
```

becomes

```yaml
resolvers:
  Query.getUser:
    dataSource: myDataSource
```

#### Pipeline functions

[Pipeline functions](pipeline-functions.md) have moved from `functionConfigurations` to `pipelineFunctions`. Just like Resolvers and datasources, `pipelineFunction` expects a key-value pair object. Use the name of the function (`name`) as the key.

Example:

```yaml
functionConfigurations:
  - name: myFunction
    dataSource: myDataSource
```

becomes

```yaml
pipelineFunctions:
  myFunction:
    dataSource: myDataSource
```

#### Authentication

In `v1` you would define the principal [authentication](authentication.md) provider directly under the `appSync` attribute. In `v2` it has moved under `authentication`.

- `authenticationType` becomes `authentication.type`
- All the specific `*Config` attributes moved to `authentication.config`.

Example:

```yaml
custom:
  appSync:
    authenticationType: AMAZON_COGNITO_USER_POOLS
    userPoolConfig:
      userPoolId: # user pool ID
```

becomes

```yaml
appSync:
  authentication:
    type: AMAZON_COGNITO_USER_POOLS
    config:
      userPoolId: # user pool ID
```

Additional auth provider are now under `additionalAuthentications`. Items follow the same stucture as `authentication`.

Example:

```yaml
additionalAuthenticationProviders:
  - authenticationType: AMAZON_COGNITO_USER_POOLS
    userPoolConfig:
      userPoolId: # user pool ID
```

becomes

```yaml
additionalAuthentications:
  - type: AMAZON_COGNITO_USER_POOLS
    config:
      userPoolId: # user pool ID
```

#### Schema

If you split your schema into several files, you must use [Object extensions](https://spec.graphql.org/October2021/#sec-Object-Extensions) on the types that have already been defined. This will often be the case for the `Query`, `Mutation` and `Subscription` types.

example:

```graphql
# users.graphql
type Query {
  getUser(id: ID!): User
}
```

```graphql
# users.graphql
type Query {
  getPost(id: ID!): Post
}
```

becomes

```graphql
# base.graphql
## The Query type must be defined before being extended
type Query
```

```graphql
# users.graphql
extend type Query {
  getUser(id: ID!): User
}
```

```graphql
# users.graphql
extend type Query {
  getPost(id: ID!): Post
}
```

#### ElasticSearch

As of September 2021, Amazon Elasticsearch Service is Amazon OpenSearch Service. DataSources of type `AMAZON_ELASTICSEARCH` should now use `AMAZON_OPENSEARCH_SERVICE` instead.

Example:

```yaml
dataSources:
  - type: AMAZON_ELASTICSEARCH
    name: myEndpoint
    config:
      endpoint: https://abcdefgh.us-east-1.es.amazonaws.com
```

becomes:

```yaml
dataSources:
  myEndpoint:
    type: AMAZON_OPENSEARCH_SERVICE
    config:
      endpoint: https://abcdefgh.us-east-1.es.amazonaws.com
```

#### Mitigate the API key rotation issue

Due to a [backwards-compatibility issue](https://github.com/sid88in/serverless-appsync-plugin/issues/584) your API keys will get rotated
(changed) upon the first deployment with the `v2` version of this plugin. If left unresolved, this will cause your clients that use the keys
to break, until you are able to update them with the newly generated API keys. 

If some down time isn't acceptable, there's two ways to mitigate this:

##### Option A: Add a temporary key

1. Add a new temporary API key throught the settings in AWS AppSync Console
2. Update all your clients to use this new temporary key
3. Deploy your API using the `v2` version of this plugin. The old API keys will get replaced by new ones, but the temporary key will get 
   retained since it's not part of the CloudFormattion stack.
5. After deployment, take the newly generated keys, and update the clients again.
6. Manually delete the temporary key from the AWS AppSync Console

##### Option B: Add an entry to `Resources` key in the `serverless.yml`

1. Find the CloudFormattion resource name of the existing API key(s). You can find the name in the *Resources* tab of your stack in the CloudFormattion AWS console.
2. Add an entry to `Resources.resources` part of the `serverless.yml` file, making sure to keep all the configuration (especially the logical ID), exactly the same.
3. Deploy your API using the `v2` version of this plugin. The old API keys will now get retained because they were manually referenced in the `Resources` part.
4. Migrate your clients to the new API keys created by the `v2` plugin
5. Delete the key from the `Resources` 

# Upgrading from v1 to v2

`v2` of this plugin tries to keep backward compatibility with `v1` from a CloudFormation perspective (i.e. Logical names are maintained). This pretends to make migration from `v1` possible. However, the API has changed quite a bit.

This page will guide you through the process of migrating existing stacks to the newer version.

## Breaking changes and dropped features

There are a few breaking changes that you need to be aware of.

### Support for Serverless Framework v3 only

`v2` only supports the new [Serverless Frmework v3](https://www.serverless.com/blog/serverless-framework-v3-is-live). You will need to upgrade to [SF v3 first](https://www.serverless.com/framework/docs/guides/upgrading-v3).

### Single API only

Support for multiple APIs has been dropped in v2. There are several reasons for this:

- **It was an edge case**: Most users would only have one API per Stack
- **It is probably bad practice**: Different APIs should be considered different micro-services and be deplopyed separately.
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

Place your APIs into defferent stacks. Unfortunately, this WILL require **the replacement of the APIs**. You can probably use [custom domains](custom-domain.md) to workaround that, if that's an option.

### Graphiql "playground"

The `graphql-playground` command which started a graphiql server pointing to the AppSync API has been removed.

**Workaround**

Use other solutions such as [Insomnia](https://insomnia.rest/), or [Postman](https://www.postman.com/)

### Support for existing APIs

`v1` offered a way to define some resoruce such as DataSources, Resolvers, etc. on an existing API (that was previously created using other mechanisms, for example manually). `v2` does no longer offer that possibility. It adds complexity, can behave unexpectidly and is probably a bad practice too. Prefer defining your whole API under the same stack.

**Workaround**

Define your API completely in the same stack. This might require **the replacement of the API**. You can use [custom domains](custom-domain.md) to workaround that, if that's an option.

### Output variables

`v1` exported some values to the stack Output by default. This is no longer the case. Instead, prefer using the new exported [variables](../README.md#variables).

**Workaround**

You still can export those values if you want but you'll have to doit explicitely yourself:

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

**Path of the appSync configuration**

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

**Renamed attributes**

Some attributes have been renamed for clarity. Here are the most important ones.

- rename `mappingTemplates` to `resolvers`
- rename `functionConfigurations` to `pipelineFunctions`
- rename `logConfig` to `log`
- rename `wafConfig` to `waf`

**DataSources**

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

**Resolvers**

[Resolvers](resolvers.md) are now defined as a key-value pair object. In `v1` you passed them as an array. Replace the array with a key-value pair object. You can use any value as the key, or use the [`Type.field` shortcut](resolvers.md).

Also rename `mappingTemplates` to `resolvers`

Example:

```yaml
mappingTemplates:
  - type: Query
    field: getUser
    dataSource: myDaaSource
```

becomes

```yaml
resolvers:
  Query.getUser:
    dataSource: myDaaSource
```

**Pipeline functions**

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

**Authentication**

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

Additional auth provider stay under `additionalAuthenticationProviders` but follow the same stucture as `authentication`.

Example:

```yaml
additionalAuthenticationProviders:
  - authenticationType: AMAZON_COGNITO_USER_POOLS
    userPoolConfig:
      userPoolId: # user pool ID
```

becomes

```yaml
additionalAuthenticationProviders:
  - type: AMAZON_COGNITO_USER_POOLS
    config:
      userPoolId: # user pool ID
```

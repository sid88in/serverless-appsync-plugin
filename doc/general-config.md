# General configuration

## Quick start

```yaml
service: my-app

plugins:
  - serverless-appsync-plugin

provider:
  name: aws

appSync:
  name: my-api

  authentication:
    type: API_KEY

  apiKeys:
    - name: myKey
      expiresAfter: 1M

  dataSources:
    my-table:
      type: AMAZON_DYNAMODB
      description: 'My table'
      config:
        tableName: my-table

  resolvers:
    Query.user:
      dataSource: my-table
```

## Configuration

- `name`: The name of this AppSync API
- `schema`: The filename of the schema file. Defaults to `schema.graphql`. [Read more](#Schema)
- `authentication`: See [Authentication](authentication.md)
- `additionalAuthenticationProviders`: See [Authentication](authentication.md)
- `apiKeys`: See [API Keys](API-keys.md)
- `domain`: See [Custom domains](custom-domain.md)
- `dataSources`: See [DataSources](dataSources.md)
- `resolvers`: See [Resolvers](resolvers.md)
- `pipelineFunctions`: See [Pipeline functions](pipeline-functions.md)
- `substitutions`: See [Substitutions](substitutions.md)
- `caching`: See [Cacing](caching.md)
- `waf`: See [Web Application Firefall](WAF.md)
- `log`: See [Logs](#Logs)
- `defaultMappingTemplates`:
  - `request`: Optional. A default request mapping template filename for all resolvers.
  - `response`: Optional. A default response mapping template filename for all resolvers.
- `mappingTemplatesLocation`:
  - `resolvers`: The location where to find resolver mapping templates, relative to the service path. Defaults to `mapping-templates`.
  - `pipelineFunctions`: The location where to find pipeline functions mapping templates. Defaults to the same value as `mappingTemplatesLocation.resolvers`.
- `xrayEnabled`: Boolean. Enable or disable X-Ray tracing.
- `tags`: A key-value pair for tagging this AppSync API

## Schema

There are different ways to define your schema. By default the schema is found in the `schema.graphql` file. The path of the file is relative to the service directory (where your `serverless.yml` file is).

```yaml
appSync:
  name: my-api
  schema: 'mySchema.graphql'
```

### Multiple files

You can specify more than one file as (an array). This is useful if you want to organize your schema into several files.

```yaml
appSync:
  name: my-api
  schema:
    - 'schemas/user.graphql'
    - 'schemas/posts.graphql'
```

You can also specify glob expressions to avoid specifying each individual file.

```yaml
appSync:
  name: my-api
  schema: 'schemas/*.graphql' # include all graphql files in the `schemas` directory
```

### Schema stitching

All the schema files will be merged together before the schema is sent to AppSync. If types are present (extended) in several files, you will need to use [Object extension](https://spec.graphql.org/October2021/#sec-Object-Extensions)

```graphql
# base.graphql

# You must create the types before you can extend them.
type Query
type Mutation
```

```graphql
# users.graphql

extend type Query {
  getUser(id: ID!): User!
}

extend type Mutation {
  createUser(user: UserInput!): User!
}

type User {
  id: ID!
  name: String!
}
```

```graphql
# posts.graphql

extend type Query {
  getPost(id: ID!): Post!
}

extend type Mutation {
  createPost(post: PostInput!): Post!
}

type Post {
  id: ID!
  title: String
  author: User!
}
```

This will result into the folowing schema:

```graphql
type Query {
  getUser(id: ID!): User!
  getPost(id: ID!): Post!
}

type Mutation {
  createUser(user: UserInput!): User!
  createPost(post: PostInput!): Post!
}

type User {
  id: ID!
  name: String!
}

type Post {
  id: ID!
  title: String
  author: User!
}
```

### Limitations and compatibility

AppSync is currently using an older version of the [Graphql Specs](https://spec.graphql.org/).
This plugin intends to use modern schemas for future-proofing. Incompatibilities will either be dropped or attempted to be fixed.

**Descriptions**

[Descriptions](https://spec.graphql.org/October2021/#sec-Descriptions) with three double quotes (`"""`) are not supported by AppSync and will be removed.

Old-style descriptions (using `#`) are supported by AppSync but will be removed by the [stitching procedure](#schema-stitching) which does not support them\*. Comments are also not supported on [enums](https://spec.graphql.org/October2021/#sec-Enums) by AppSync.

\* If you want to retain `#` comments, the workwround is to skip schema stiching by putting your whole schema into one single file.

**Multiple interfaces**

Types can implement multiple [interfaces](https://spec.graphql.org/October2021/#sec-Interfaces) using an ampersand `&` in GraphQL, but AppSync uses the old comma (`,`) separator. `&` is the only separator suported by this plugin, but it will automatically be replaced with a `,`.

## Logs

```yaml
appSync:
  name: my-api
  log:
    level: ERROR
    logRetentionInDays: 14
```

- `level`: `ERROR`, `NONE`, or `ALL`
- `excludeVerboseContent`: Boolean. Exclude or not verbose content.
- `logRetentionInDays`: Number of days to retain the logs.
- `roleArn`: Optional. The role ARN to use for AppSync to write into CloudWatch. If not specified, a new role is created by default.

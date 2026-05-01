# Commands

This plugin provides some useful commands to explore and manage your API.

## Quick reference

| Command                         | Description                         |
| ------------------------------- | ----------------------------------- |
| `sls appsync validate-schema`   | Validate the GraphQL schema         |
| `sls appsync get-introspection` | Export the introspection schema     |
| `sls appsync flush-cache`       | Flush the API cache                 |
| `sls appsync console`           | Open the AWS console                |
| `sls appsync cloudwatch`        | Open CloudWatch logs                |
| `sls appsync logs`              | Stream logs to stdout               |
| `sls appsync evaluate`          | Evaluate a resolver or VTL template |
| `sls appsync env get`           | Get API environment variables       |
| `sls appsync env set`           | Set an API environment variable     |
| `sls appsync domain *`          | Manage custom domains               |

## `validate-schema`

This commands allows you to validate your GraphQL schema.

```bash
sls appsync validate-schema
```

## `get-introspection`

Allows you to extract the introspection of the schema as a JSON or SDL.

**Options**

- `--format` or `-f`: the format in which to extract the schema. `JSON` or `SDL`. Defaults to `JSON`
- `--output` or `-o`: a file where to output the schema. If not specified, prints to stdout

```bash
sls appsync get-introspection
```

## `flush-cache`

If your API uses the server-side [Caching](caching.md), this command flushes the cache.

```bash
sls appsync flush-cache
```

## `console`

Opens a new browser tab to the AWS console page of this API.

```bash
sls appsync console
```

## `cloudwatch`

Opens a new browser tab to the CloudWatch logs page of this API.

```bash
sls appsync cloudwatch
```

## `logs`

Outputs the logs of the AppSync API to stdout.

**Options**

- `--startTime`: Starting time. You can use human-friendly relative times. e.g. `30m`, `1h`, etc. Default: `10m` (10 minutes ago)
- `--tail` or `-t`: Keep streaming new logs.
- `--interval` or `-i`: Tail polling interval in milliseconds. Default: `1000`.
- `--filter` or `-f`: A filter pattern to apply to the logs stream.

```bash
sls appsync logs --filter '86771d0c-c0f3-4f54-b048-793a233e3ed9'
```

## `evaluate`

Evaluate a resolver or VTL mapping template against a context without deploying. Uses the AppSync `EvaluateCode` and `EvaluateMappingTemplate` APIs.

**Evaluate a JS resolver (APPSYNC_JS runtime)**

The resolver must be a `UNIT` resolver with a `code` property defined in your configuration.

**Options**

- `--type` or `-t`: GraphQL type (e.g. `Query`)
- `--field` or `-f`: GraphQL field (e.g. `getUser`)
- `--function`: Function to evaluate: `request` or `response`. Default: `request`
- `--context` or `-c`: Path to a JSON context file, or an inline JSON string. Default: `{}`

```bash
sls appsync evaluate --type Query --field getUser --function request
sls appsync evaluate --type Query --field getUser --function response --context context.json
sls appsync evaluate --type Mutation --field createPost --context '{"arguments":{"title":"Hello"}}'
```

**Evaluate a VTL mapping template**

- `--template`: Path to a `.vtl` template file
- `--context` or `-c`: Path to a JSON context file, or an inline JSON string. Default: `{}`

```bash
sls appsync evaluate --template templates/getUser.request.vtl
sls appsync evaluate --template templates/getUser.request.vtl --context context.json
```

The command prints the evaluation result to stdout. Errors (including line/column info for JS) are printed to stderr.

For a detailed guide on testing unit and pipeline resolvers with this command — including fixture structure, a shell script for chaining pipeline steps, and Jest integration test examples — see [Testing Resolvers](testing-resolvers.md).

## `env`

Manage the environment variables of the deployed AppSync API at runtime, without redeploying. Uses the `GetGraphqlApiEnvironmentVariables` and `PutGraphqlApiEnvironmentVariables` APIs.

> **Note:** These commands operate on the _deployed_ API. To set environment variables that are baked into the CloudFormation stack, use the [`environment`](general-config.md) configuration key instead.

### `env get`

Prints all environment variables currently set on the deployed API.

```bash
sls appsync env get
```

### `env set`

Adds or updates a single environment variable on the deployed API. Existing variables are preserved — only the specified key is changed.

**Options**

- `--key` or `-k`: Environment variable key (required)
- `--value` or `-v`: Environment variable value (required)

```bash
sls appsync env set --key TABLE_NAME --value prod-table
sls appsync env set --key STAGE --value production
```

## `domain`

Manage the domain for this AppSync API.

## Create the domain

Before associating a domain to an API, you must first create it. You can do so using the following command.

**Options**

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--stage`: The stage to use

```bash
sls appsync domain create
```

## Delete the domain

Deletes a domain from AppSync.

**Options**

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--yes` or `-y`: Automatic yes to prompts
- `--stage`: The stage to use

```bash
sls appsync domain delete
```

If an API is associated to it, you will need to [disassociate](#disassociate-the-api-from-the-domain) it first.

## Create a route53 record

If you use Route53 for your hosted zone, you can also create the required CNAME record for your custom domain.

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--stage`: The stage to use

```bash
sls appsync domain create-record
```

## Delete the route53 record

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--yes` or `-y`: Automatic yes to prompts
- `--stage`: The stage to use

```bash
sls appsync domain delete-record
```

## Associate the API to the domain

Associate the API in this stack to the domain.

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--stage`: The stage to use

```bash
sls appsync domain assoc --stage dev
```

You can associate an API to a domain that already has another API attached to it. The old API will be replaced by the new one.

## Disassociate the API from the domain

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--yes` or `-y`: Automatic yes to prompts
- `--stage`: The stage to use

```bash
sls appsync domain disassoc --stage dev
```

# Examples

Runnable, copy-pasteable example projects for `serverless-appsync-plugin`.

Each subfolder is a complete Serverless Framework project that you can:

1. **Read** to learn how to configure a specific feature
2. **Copy** as a starting point for your own project
3. **Deploy** with `serverless deploy` to see it work on real AWS

These examples are also used as fixtures by the plugin's
[CFN synthesis test suite](../e2e/README.md), so they're guaranteed to
stay current with the plugin's actual behavior — if they break, CI fails.

## Index

| Example                                                       | What it shows                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [basic-api-key](./basic-api-key/)                             | Simplest possible setup: API key auth, one DynamoDB data source, one resolver              |
| [cognito-userpools](./cognito-userpools/)                     | Cognito User Pools authentication with default action and user groups                      |
| [iam-auth](./iam-auth/)                                       | AWS IAM authentication                                                                     |
| [oidc-auth](./oidc-auth/)                                     | OpenID Connect authentication                                                              |
| [lambda-authorizer](./lambda-authorizer/)                     | Custom AWS Lambda authorizer                                                               |
| [multi-auth](./multi-auth/)                                   | Multiple authentication providers (API Key primary + Cognito + IAM additional)             |
| [lambda-resolvers-js](./lambda-resolvers-js/)                 | JS resolvers bundled with esbuild + Lambda data sources                                    |
| [lambda-resolvers-vtl](./lambda-resolvers-vtl/)               | VTL request/response mapping templates                                                     |
| [pipeline-resolvers](./pipeline-resolvers/)                   | Pipeline resolvers with reusable functions                                                 |
| [datasource-http](./datasource-http/)                         | HTTP data source with optional IAM signing                                                 |
| [datasource-none](./datasource-none/)                         | NONE data source (local resolvers)                                                         |
| [datasource-eventbridge](./datasource-eventbridge/)           | EventBridge data source                                                                    |
| [datasource-opensearch](./datasource-opensearch/)             | Amazon OpenSearch Service data source                                                      |
| [datasource-rds](./datasource-rds/)                           | Relational Database (Aurora Serverless) data source                                        |
| [caching](./caching/)                                         | Server-side caching configuration                                                          |
| [waf](./waf/)                                                 | AWS WAF v2 rules attached to the API                                                       |
| [logging-xray](./logging-xray/)                               | Field-level logging plus X-Ray tracing                                                     |
| [custom-domain](./custom-domain/)                             | Custom domain with route53 record management                                               |
| [introspection-disabled](./introspection-disabled/)           | Disabled introspection and query depth limit                                               |
| [substitutions](./substitutions/)                             | VTL `${variable}` substitutions in resolvers                                               |
| [environment-variables](./environment-variables/)             | Environment variables for JS resolvers                                                     |
| [api-keys-multiple](./api-keys-multiple/)                     | Multiple API keys with different expiry policies                                           |
| [tags](./tags/)                                               | Resource tagging on the AppSync API                                                        |
| [visibility-private](./visibility-private/)                   | PRIVATE API visibility for VPC-only access                                                 |
| [schema-multiple-files](./schema-multiple-files/)             | Schema split across multiple `.graphql` files                                              |
| [sync-config-versioned](./sync-config-versioned/)             | DynamoDB conflict resolution (OPTIMISTIC_CONCURRENCY + AUTOMERGE) with delta sync          |
| [custom-domain-no-cfn](./custom-domain-no-cfn/)               | Custom domain managed outside CloudFormation (via the plugin's CLI commands)               |
| [waf-pre-existing-arn](./waf-pre-existing-arn/)               | Attach a pre-existing shared WAF WebACL by ARN                                             |
| [pipeline-resolver-with-code](./pipeline-resolver-with-code/) | Pipeline resolver with its own top-level JS (before/after handlers) plus per-function code |
| [api-key-import-existing](./api-key-import-existing/)         | Import an existing API key by ID (stable migration) alongside auto-generated keys          |

## How to run an example

Pick one, `cd` into it, then:

```bash
npm install
serverless deploy
```

You'll need AWS credentials configured and `serverless` installed
globally or available via `npx`.

## How they fit into the test suite

Each example is exercised by a test in `e2e/` that runs
`serverless package` (CloudFormation synthesis without deploying) and
asserts on the generated CloudFormation template. This catches breakages
at compile time without requiring AWS credentials in PR CI.

See [e2e/README.md](../e2e/README.md) for details.

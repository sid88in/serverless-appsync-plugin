# Live AWS integration tests

This is an **opt-in** test suite that exercises the plugin's live AWS code
paths (the ones the [AWS SDK v3 migration in #686](https://github.com/sid88in/serverless-appsync-plugin/pull/686)
most affects) against a **real AWS account**. It is complementary to:

- `npm test` — unit tests (`src/__tests__`), no AWS.
- `npm run test:e2e` — offline CloudFormation-synthesis tests (`e2e/`), no AWS.

Unlike those, the integration suite **costs money and needs credentials**, so it
never runs in the default CI or as part of `npm test` / `npm run test:e2e` /
`npm run test:all`. It is gated behind the `APPSYNC_PLUGIN_INTEGRATION`
environment variable and, when that is unset, every suite resolves to
`describe.skip` and the run exits green.

## What it proves

Each scenario maps to a live command and the SDK call it validates:

| Tier | Command                           | Live SDK call(s)                                                                   | Notes                          |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| A    | `appsync evaluate --template`     | `EvaluateMappingTemplate`                                                          | no deploy                      |
| A    | `appsync evaluate --type/--field` | `EvaluateCode`                                                                     | no deploy                      |
| B    | `serverless info`                 | `ListApiKeys`, `GetGraphqlApi`, `DescribeStackResources`                           | get-api-keys                   |
| B    | `appsync get-introspection`       | `GetIntrospectionSchema`                                                           |                                |
| B    | `appsync env set` / `env get`     | `Put`/`GetGraphqlApiEnvironmentVariables`                                          |                                |
| B    | `appsync logs`                    | `FilterLogEvents` (CloudWatch Logs)                                                | log group from fixture logging |
| B    | **credential/region proof**       | deploy + live read                                                                 | the headline #686 test         |
| C    | `appsync flush-cache`             | `FlushApiCache`                                                                    | caching billed hourly          |
| D    | `appsync domain create`           | `ListCertificates` (ACM, **us-east-1 pin**) + `CreateDomainName`                   |                                |
| D    | `appsync domain assoc`            | `GetApiAssociation` (+ `NotFoundException` path) + `AssociateApi`                  |                                |
| D    | `appsync domain create-record`    | `ListHostedZonesByName` + `ChangeResourceRecordSets` + `GetChange` (poll → INSYNC) |                                |

The **credential/region proof** is the most valuable test: it deploys with an
explicit `--region` (and optional `--aws-profile`), asserts the API actually
landed in that region (by reading the stack's AppSync API ARN), confirms a live
command pointed at that region succeeds, and confirms the same command pointed
at a **different** region fails to find the API — demonstrating that the live
commands honor the region resolved from the Serverless provider, not the bare
default credential chain.

## Tiers and gating

| Tier               | Switch (in addition to `APPSYNC_PLUGIN_INTEGRATION=1`)                            | Cost profile                                  |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------- |
| A — evaluate       | none                                                                              | negligible (a few AppSync requests)           |
| B — minimal deploy | none                                                                              | cents (no hourly charge; 1-day log retention) |
| C — caching        | `APPSYNC_PLUGIN_INTEGRATION_CACHING=1`                                            | **hourly** caching instance while it exists   |
| D — custom domain  | `APPSYNC_PLUGIN_INTEGRATION_DOMAIN` + `APPSYNC_PLUGIN_INTEGRATION_HOSTED_ZONE_ID` | minimal (reuses existing zone + cert)         |

Tiers are independently skippable: with only credentials set you get A and B;
caching and domain stay skipped until you opt in.

## Running it

```bash
# Tiers A + B (cheapest useful run)
APPSYNC_PLUGIN_INTEGRATION=1 \
APPSYNC_PLUGIN_INTEGRATION_REGION=us-west-2 \
AWS_PROFILE=my-sandbox \
npm run test:integration

# Add the caching tier
APPSYNC_PLUGIN_INTEGRATION=1 \
APPSYNC_PLUGIN_INTEGRATION_REGION=us-west-2 \
APPSYNC_PLUGIN_INTEGRATION_CACHING=1 \
AWS_PROFILE=my-sandbox \
npm run test:integration

# Full credential/region proof with an explicit profile whose default region
# differs from the test region
APPSYNC_PLUGIN_INTEGRATION=1 \
APPSYNC_PLUGIN_INTEGRATION_REGION=us-west-2 \
APPSYNC_PLUGIN_INTEGRATION_PROFILE=my-sandbox \
npm run test:integration
```

### Environment variables

| Variable                                         | Required | Description                                                                                                                               |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `APPSYNC_PLUGIN_INTEGRATION`                     | yes      | Master switch; must be `1`.                                                                                                               |
| `APPSYNC_PLUGIN_INTEGRATION_REGION`              | no       | Test region (default `us-west-2`). Choose something other than `us-east-1` so the ACM us-east-1 pin and the region proof are meaningful.  |
| `APPSYNC_PLUGIN_INTEGRATION_PROFILE`             | no       | Named profile for the deploy/commands; also enables the profile half of the credential proof. Falls back to the default credential chain. |
| `APPSYNC_PLUGIN_INTEGRATION_OTHER_REGION`        | no       | Region used by the negative half of the region proof (default: the opposite of the test region).                                          |
| `APPSYNC_PLUGIN_INTEGRATION_EXPECTED_ACCOUNT_ID` | no       | If set, the profile proof asserts the deployed API's account matches it.                                                                  |
| `APPSYNC_PLUGIN_INTEGRATION_CACHING`             | no       | `1` to run the caching tier.                                                                                                              |
| `APPSYNC_PLUGIN_INTEGRATION_DOMAIN`              | no       | Domain name for the custom-domain tier (e.g. `it.example.com`).                                                                           |
| `APPSYNC_PLUGIN_INTEGRATION_HOSTED_ZONE_ID`      | no       | Route53 hosted zone id for that domain.                                                                                                   |
| `APPSYNC_PLUGIN_INTEGRATION_CERT_ARN`            | no       | ISSUED ACM cert ARN (us-east-1). If omitted, the plugin discovers a matching cert via `ListCertificates`.                                 |
| `SERVERLESS_BIN`                                 | no       | Path to a Serverless binary (e.g. a v4 install). Defaults to the repo's v3.                                                               |

Standard AWS credential variables (`AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, OIDC
`AWS_ROLE_ARN`, …) are honored as usual.

### Typecheck only

```bash
npm run test:integration:typecheck   # tsc -p tsconfig.integration.json
```

## Teardown and leaked-resource recovery

Reliable teardown is the suite's top priority:

- Every resource is named with a unique per-run id (`appsync-plugin-it-<ts>-<rand>`)
  and tagged `appsync-plugin-integration: <run id>`.
- Deploy tiers tear down with `serverless remove` in `afterAll` (runs even on
  failure). The custom-domain tier additionally deletes its non-CloudFormation
  resources (Route53 record → API association → domain name) in reverse order.
  The ACM certificate is **reused, never created, and never deleted**.
- If a run is interrupted, recover leaks with the standalone sweeper:

```bash
APPSYNC_PLUGIN_INTEGRATION=1 \
APPSYNC_PLUGIN_INTEGRATION_REGION=us-west-2 \
AWS_PROFILE=my-sandbox \
[APPSYNC_PLUGIN_INTEGRATION_DOMAIN=it.example.com] \
npm run test:integration:sweep
```

The sweeper deletes AppSync APIs tagged by the suite, CloudFormation stacks
named with the run-id prefix, and (if a domain is configured) a leaked custom
domain name. It is idempotent and safe to re-run. CloudFormation stack deletes
are asynchronous — verify completion in the console.

## Least-privilege IAM policy

The actions actually used by the suite are below. Note that a `serverless
deploy` is itself a CloudFormation operation that creates an AppSync API, an
API key, a CloudWatch log group + logging role, and an S3 deployment bucket;
fully constraining a deploy role is involved, so in a throwaway sandbox account
many teams simply use a broader deploy role. The policy below is the scoped
target.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AppSync",
      "Effect": "Allow",
      "Action": [
        "appsync:CreateGraphqlApi",
        "appsync:DeleteGraphqlApi",
        "appsync:UpdateGraphqlApi",
        "appsync:GetGraphqlApi",
        "appsync:ListGraphqlApis",
        "appsync:StartSchemaCreation",
        "appsync:GetSchemaCreationStatus",
        "appsync:GetIntrospectionSchema",
        "appsync:CreateApiKey",
        "appsync:DeleteApiKey",
        "appsync:ListApiKeys",
        "appsync:CreateDataSource",
        "appsync:DeleteDataSource",
        "appsync:UpdateDataSource",
        "appsync:CreateResolver",
        "appsync:DeleteResolver",
        "appsync:CreateFunction",
        "appsync:DeleteFunction",
        "appsync:FlushApiCache",
        "appsync:CreateApiCache",
        "appsync:DeleteApiCache",
        "appsync:EvaluateCode",
        "appsync:EvaluateMappingTemplate",
        "appsync:GetGraphqlApiEnvironmentVariables",
        "appsync:PutGraphqlApiEnvironmentVariables",
        "appsync:TagResource",
        "appsync:UntagResource",
        "appsync:ListTagsForResource",
        "appsync:CreateDomainName",
        "appsync:DeleteDomainName",
        "appsync:GetDomainName",
        "appsync:ListDomainNames",
        "appsync:AssociateApi",
        "appsync:DisassociateApi",
        "appsync:GetApiAssociation"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFormation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackResources",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate",
        "cloudformation:ListStacks",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:PutRetentionPolicy",
        "logs:DescribeLogGroups",
        "logs:TagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IamForDeploy",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:TagRole"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DeploymentBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:PutBucketTagging",
        "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DomainTierOnly",
      "Effect": "Allow",
      "Action": [
        "acm:ListCertificates",
        "route53:ListHostedZonesByName",
        "route53:ChangeResourceRecordSets",
        "route53:GetChange"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Identity",
      "Effect": "Allow",
      "Action": ["sts:GetCallerIdentity"],
      "Resource": "*"
    }
  ]
}
```

If you skip the custom-domain tier (the default), the `DomainTierOnly` statement
and the domain-related AppSync actions are unnecessary.

## Serverless v4 note

The suite spawns the `serverless` binary from `node_modules` (override with
`SERVERLESS_BIN`), so it can be pointed at a Serverless v4 install. Two caveats,
unverified here:

- v4 may require `SERVERLESS_ACCESS_KEY` / a license and suppression of login
  prompts (the wrappers already disable telemetry and interactive setup).
- v4 resolves credentials as SDK v3 objects, so the v2-style `getPromise` /
  `expireTime` branch in the plugin's `resolveCredentials` will not fire (it
  degrades gracefully). Re-confirm the credential/region proof under v4.

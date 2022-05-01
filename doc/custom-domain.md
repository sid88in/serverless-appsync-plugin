# Custom Domains

AppSync supports associating your API to a [custom domain](https://aws.amazon.com/blogs/mobile/introducing-custom-domain-names-for-aws-appsync-apis/).

The configuration for custom domain can be found under the `appSync.domain` attribute.

## Quick start

```yaml
appSync:
  name: my-api
  domain:
    name: api.example.rehab
    certificateArn: arn:aws:acm:us-east-1:123456789:certificate/7e14a3b2-f7a5-4da5-8150-4a03ede7158c
```

## Configuration

- `name`: Required. The fully qualified domain name to assiciate this API to.
- `certificateArn`: Optional. A valid certificate ARN for the domain name. If not provided, this plugin will try its best finding a certificate that matches the domain.
- `useCloudFormation`: Boolean. Optional. Wheter to use CloudFormation or CLI commands to manage the domain. See [Using CloudFormation or CLI commands](#using-cloudformation-vs-the-cli-commands). Defaults to `true`.
- `retain`: Boolean. Optional. Whether to retain the domain and domain association when they are removed from CloudFormation. Defaults to `false`. See [Ejecting from CloudFormation](#ejecting-from-cloudformation)
- `route53`: See [Route53 configuration](#route53-configuration). Defaults to `true`

## Certificate

This plugin does not provide any way to generate or manage your domain certificate. This is usually a set-and-forget kind of operation. You still need to provide its ARN and it must be a valid certificate for the provided domain name.

## Route53 configuration

When `true`, this plugin will try to create a Route53 CNAME entry in the Hosted Zone corresponding to the domain. This plugin will do its best to find the best Hosted Zone that matches the domain name.

When `false`, no CNAME record will be created.

You can also specify which hosted zone you want to create the record into:

- `hostedZoneName`: The specific hosted zone name where to create the CNAME record.
- `hostedZoneId`: The specific hosted zone id where to create the CNAME record.

example:

```yaml
appSync:
  domain: api.example.com
  route53:
    hostedZoneId: ABCDEFGHIJ
```

## Using CloudFormation vs the CLI commands

There are two ways to manage your custom domain:

- using CloudFormation
- using the CLI [commands](commands.md#domain)

If `useCloudFormation` is set to `true`, the domain and domain association will be automatically created and managed by CloudFormation. However, in some cases you might not want that.

For example, if you wanted to use blue/green deployments, you might need to associate APIs from different stacks to the same domain. In that case, the only way to do it is to use the CLI.

For more information about managing domains with the CLI, see the [Commands](commands.md#domain) section.

## Ejecting from CloudFormation

If you started to manage your domain through CloudFormation and want to eject from it, follow the following steps:

1. Set `retain` to `true`

To avoid breaking your API if it is already on production, you first need to tell CloudFormation to retain the domain and any association with an existing API. For that, you can set the `retain` attribute to `true`. **You will then need to re-deploy to make sure that CloudFormation takes the change into account.**

2. Set `useCloudFormation` to `false`

You can now set `useCloudFormation` to `false` and **deploy one more time**. The domain and domain association resources will be removed from the CloudFormation template, but the resources will be retained (see point 1.)

3. Manage your domain using the CLI

You can now manage your domain using the CLI [commands](commands.md#domain)

## Domain names per stage

You can use different domains by stage easily thanks to [Serverless Framework Stage Parameters](https://www.serverless.com/framework/docs/guides/parameters)

```yaml
params:
  prod:
    domain: api.example.com
    domainCert: arn:aws:acm:us-east-1:123456789:certificate/7e14a3b2-f7a5-4da5-8150-4a03ede7158c

  staging:
    domain: qa.example.com
    domainCert: arn:aws:acm:us-east-1:123456789:certificate/61d7d798-d656-4630-9ff9-d77a7d616dbe

  default:
    domain: ${sls:stage}.example.com
    domainCert: arn:aws:acm:us-east-1:379730309663:certificate/44211071-e102-4bf4-b7b0-06d0b78cd667

appSync:
  name: my-api
  domain:
    name: ${param:domain}
    certificateArn: ${param:domainCert}
```

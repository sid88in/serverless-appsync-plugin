# Custom Domains

AppSync supports associating your API to a [custom domain](https://aws.amazon.com/blogs/mobile/introducing-custom-domain-names-for-aws-appsync-apis/).

The configuration for custom domain can be found under the `appSync.domain` attribute.

## Quick start

```yaml
appSync:
  name: my-api
  domain:
    name: api.example.com
    certificateArn: arn:aws:acm:us-east-1:123456789:certificate/7e14a3b2-f7a5-4da5-8150-4a03ede7158c
```

## Configuration

- `name`: Required. The fully qualified domain name to assiciate this API to.
- `certificateArn`: Optional. A valid certificate ARN for the domain name. See [Certificate](#certificate).
- `useCloudFormation`: Boolean. Optional. Wheter to use CloudFormation or CLI commands to manage the domain. See [Using CloudFormation or CLI commands](#using-cloudformation-vs-the-cli-commands). Defaults to `true`.
- `retain`: Boolean. Optional. Whether to retain the domain and domain association when they are removed from CloudFormation. Defaults to `false`. See [Ejecting from CloudFormation](#ejecting-from-cloudformation)
- `hostedZoneId`: Boolean, conditional. The Route53 hosted zone id where to create the certificate validation and AppSync Alias records. Required if `useCloudFormation` is `true` and `certificateArn` is not provided.
- `hostedZoneName`: The hosted zone name where to create the route53 Alias record.
- `route53`: Boolean. wether or not to create the Rotue53 Alias for this domain. Set to `false` if you don't use Route53. Defaults to `true`

## Certificate

When a valid `certificateArn` is not provided, this plugin will try to generate one for the
provided domain `name`. If `useCloudFormation` is `true`, you must provide the `hostedZoneId`
where the DNS validation records for the certificate will be created. If `useCloudFormation` is
`false`, this plugin will first try to find an existing certificate that matches the given domain
when using the `domain create` command. If no valida certificate is found, it will prompt you to generate a new one.

⚠️ Any change that requires a change of certificate requires a replacement of the domain in AppSync. CloudFormation will usually fail with the following error when that happens:

```bash
CloudFormation cannot update a stack when a custom-named resource requires replacing. Rename api.example.com and update the stack again.
```

## Route53 configuration

When `true`, this plugin will try to create a Route53 CNAME entry in the Hosted Zone corresponding to the domain. This plugin will do its best to find the best Hosted Zone that matches the domain name.

When `false`, no CNAME record will be created.

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

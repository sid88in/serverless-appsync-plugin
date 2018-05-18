<h1 align="center">
  Serverless-AppSync-Plugin 👌
  <h4 align="center"><a href="https://serverless.com" target="_blank">Serverless</a> plugin that allows you to deploy, update or delete your <a href="https://aws.amazon.com/appsync" target="_blank">AWS AppSync</a> API's with ease.</h4>
  <br>
</h1>

Tired of 🚀 **deploying**, ✏️ **updating**, and ❌ **deleting** your AppSync API's using the AWS AppSync dashboard? You can now develop all of your AppSync API's locally using **Serverless** + **Serverless-AppSync-Plugin**! With support for <a href="https://aws.amazon.com/dynamodb" target="_blank">AWS DynamoDB</a>, <a href="https://aws.amazon.com/lambda" target="_blank">AWS Lambda</a>, and <a href="https://aws.amazon.com/elasticsearch-service" target="_blank">AWS Elastic Search</a>; you have everything you need to get started developing your AppSync API's locally.

<div align="center">Find AppSync examples in the <a href="https://github.com/serverless/serverless-graphql/tree/master/app-backend/appsync" target="_blank"> Serverless-GraphQL</a> Repo 👈</div>

# Introduction

> *Part 1:* [Running a scalable & reliable GraphQL endpoint with Serverless](https://serverless.com/blog/running-scalable-reliable-graphql-endpoint-with-serverless/)
> *Part 2:* [AppSync Backend: AWS Managed GraphQL Service](https://medium.com/@sid88in/running-a-scalable-reliable-graphql-endpoint-with-serverless-24c3bb5acb43)
> *Part 3:* [AppSync Frontend: AWS Managed GraphQL Service](https://hackernoon.com/running-a-scalable-reliable-graphql-endpoint-with-serverless-db16e42dc266)

![appsync architecture](https://user-images.githubusercontent.com/1587005/36063617-fe8d4e5e-0e33-11e8-855b-447513ba7084.png)

<details>
 <summary><strong>Table of Contents</strong> (click to expand)</summary>

* [Getting Started](#-getting-started)
* [Installation](#-installation)
* [Usage](#️-usage)
* [Contributing](#-contributing)
* [Credits](#️-credits)
</details>

## ⚡️ Getting Started

Be sure to check out all that <a href="https://aws.amazon.com/appsync" target="_blank">AWS AppSync</a> has to offer. Here are a few resources to help you understand everything needed to get started!

* <a target="_blank" href="https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference.html">Mapping Templates</a> - Not sure how to create Mapping Templates for **DynamoDB**, **Lambda** or **Elastic Search**? Here's a great place to start!
* <a target="_blank" href="https://docs.aws.amazon.com/appsync/latest/devguide/tutorials.html">Data Sources and Resolvers</a> - Get more information on what data sources are supported and how to set them up!
* <a target="_blank" href="https://docs.aws.amazon.com/appsync/latest/devguide/security.html">Security</a> - Checkout this guide to find out more information on securing your API endpoints with AWS_IAM or Cognito User Pools!

## 💾 Installation

Install the plugin via <a href="https://yarnpkg.com/lang/en/docs/install/">Yarn</a> (recommended)

```
yarn add serverless-appsync-plugin
```

or via <a href="https://docs.npmjs.com/cli/install">NPM</a>

```
npm install serverless-appsync-plugin
```
### Configuring the plugin

Add ```serverless-appsync-plugin``` to the plugins section of ```serverless.yml```

```
plugins:
   - serverless-appsync-plugin
```

Add the following example config to the custom section of ```serverless.yml```

```yaml
custom:
  accountId: abc # found here https://console.aws.amazon.com/billing/home?#/account
  appSync:
    name:  # defaults to api
    # apiKey # only required for update-appsync/delete-appsync
    authenticationType: AMAZON_COGNITO_USER_POOLS
    userPoolConfig:
      awsRegion: # required # region
      defaultAction: # ALLOW
      userPoolId: # required # user pool ID
      region: # defaults to provider region
    mappingTemplatesLocation: # defaults to mapping-templates
    mappingTemplates:
      - dataSource: # data source name
        type: # Query, Mutation, Subscription
        field: getUserInfo
        request: # request mapping template name
        response: # response mapping template name
    schema: # defaults schema.graphql
    serviceRole: "AppSyncServiceRole" # AppSyncServiceRole is a role defined by amazon and available in all accounts
    dataSources:
      - type: AMAZON_DYNAMODB
        name: # data source name
        description: # DynamoDB Table Description
        config:
          tableName: { Ref: MyTable } # Where MyTable is a dynamodb table defined in Resources
          serviceRoleArn: { Fn::GetAtt: [AppSyncDynamoDBServiceRole, Arn] } # Where AppSyncDynamoDBServiceRole is an IAM role defined in Resources
      - type: AMAZON_ELASTICSEARCH
        name: # data source name
        description: 'ElasticSearch'
        config:
          endpoint: # required # "https://{DOMAIN}.{REGION}.es.amazonaws.com"
          serviceRoleArn: { Fn::GetAtt: [AppSyncESServiceRole, Arn] } # Where AppSyncESServiceRole is an IAM role defined in Resources
      - type: AWS_LAMBDA
        name: # data source name
        description: 'Lambda DataSource'
        config:
          lambdaFunctionArn: { Fn::GetAtt: [GraphqlLambdaFunction, Arn] } # Where GraphqlLambdaFunction is the lambda function cloudformation resource created by serverless for the serverless function named graphql
          serviceRoleArn: { Fn::GetAtt: [AppSyncLambdaServiceRole, Arn] } # Where AppSyncLambdaServiceRole is an IAM role defined in Resources
```

> Be sure to replace all variables that have been commented out, or have an empty value.

## ▶️ Usage

### `serverless deploy`

This command will all AppSync resources in the same cloudformation template used by the other serverless resources

## 📝 Notes

* If you are planning on using <a target="_blank" href="https://aws.amazon.com/elasticsearch-service">AWS Elastic Search</a>, you will need to create an Elastic Search domain/endpoint on AWS and set it as the ```endpoint``` option in  ```serverless.yml``` **before** deploying.

## 🎁 Contributing

If you have any questions, please feel free to reach out to me directly on Twitter <a target="_blank" href="https://twitter.com/sidg_sid">Sid Gupta</a>.

## 👷 Migration from versions prior to 1.0
<a id="cfn-migration"></a>

If you have previously used versions of this plugin prior to 1.0, you will need
to perform some additional manual steps in order to continue use of this
plugin (it will be worth it).  This change removes the `sls *-appsync`
commands in favor of adding AppSync resources directly to the serverless
cloudformation stack. What this means for your existing APIs is that
they can no longer be updated.  The good news is that you will
no longer need to use separate commands to deploy vs update and update
your serverless config with the created `apiId`.

The rough steps for migration are as follows:
1. Run `sls deploy` to create the new AppSync api and make note
of the endpoint returned as part of the stack outputs. *If you were
using an `API_KEY` auth type, you will also need the new api key which
is also included in the stack outputs.*
2. Update existing consumers of your API to use the new endpoint. *If
you're using an api key, this will also need updated*
3. After verifying all existing consumers are updated, run `sls delete-appsync`
to cleanup the old resources
4. Remove the `apiId` line from `custom.appSync` in `serverless.yml`
5. 🍹

## ❤️ Credits

Big Thanks to <a target="_blank" href="https://twitter.com/nikgraf">Nik Graf</a>, <a target="_blank" href="https://twitter.com/pmmuens">Philipp Müns</a>, <a target="_blank" href="https://twitter.com/superpatell">Jon Patel</a> and my favourite <a target="_blank" href="https://twitter.com/lolcoolkat">coolest kat ever</a> for helping to build this plugin!

We are always looking for open source contributions. So, feel free to create issues/contribute to this repo.

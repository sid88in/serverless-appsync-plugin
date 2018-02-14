<h1 align="center">
  Serverless-AppSync-Plugin 👌
  <h4 align="center"><a href="https://serverless.com" target="_blank">Serverless</a> plugin that allows you to deploy, update or delete your <a href="https://aws.amazon.com/appsync" target="_blank">AWS AppSync</a> API's with ease.</h4>
  <br>
</h1>

Tired of 🚀 **deploying**, ✏️ **updating**, and ❌ **deleting** your AppSync API's using the AWS AppSync dashboard? You can now develop all of your AppSync API's locally using **Serverless** + **Serverless-AppSync-Plugin**! With support for <a href="https://aws.amazon.com/dynamodb" target="_blank">AWS DynamoDB</a>, <a href="https://aws.amazon.com/lambda" target="_blank">AWS Lambda</a>, and <a href="https://aws.amazon.com/elasticsearch-service" target="_blank">AWS Elastic Search</a>; you have everything you need to get started developing your AppSync API's locally. 

<div align="center">Find AppSync examples in the <a href="https://github.com/serverless/serverless-graphql/tree/master/app-backend/appsync" target="_blank"> Serverless-GraphQL</a> Repo 👈</div>


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
* <a target="_blank" href="https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference.html">Data Sources and Resolvers</a> - Get more information on what data sources are supported and how to set them up!
* <a target="_blank" href="https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference.html">Security</a> - Checkout this guide to find out more information on securing your API endpoints with AWS_IAM or Cognito User Pools!

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
    # apiId # only required for update-appsync/delete-appsync
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
    serviceRole: "AppSyncServiceRole"
    dataSources:
      - type: AMAZON_DYNAMODB
        name: # data source name
        description: # DynamoDB Table Description
        config:
          tableName: # DynamoDB Table Name
          serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/dynamo-${self:custom.appSync.serviceRole}"
      - type: AMAZON_ELASTICSEARCH
        name: # data source name
        description: 'ElasticSearch'
        config:
          endpoint: # required # "https://{DOMAIN}.{REGION}.es.amazonaws.com"
          serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/elasticSearch-${self:custom.appSync.serviceRole}"
      - type: AWS_LAMBDA
        name: # data source name
        description: 'Lambda DataSource'
        config:
          lambdaFunctionArn: "arn:aws:lambda:us-east-1:${self:custom.accountId}:function:appsync-example-dev-graphql"
          serviceRoleArn: "arn:aws:iam::${self:custom.accountId}:role/Lambda-${self:custom.appSync.serviceRole}"
```

> Be sure to replace all variables that have been commented out, or have an empty value.

## ▶️ Usage

### `serverless deploy-appsync`

This command will **deploy** a new AppSync API endpoint using the ```name``` specified in the custom section of ```serverless.yml``` under ```appSync```.

### `serverless update-appsync`

This command will **update** an existing AppSync API endpoint using the ```apiId``` specified in the custom section of ```serverless.yml``` under ```appSync```. (Data sources/resolvers will be **automatically** created if they don't already exist)

### `serverless delete-appsync`

This command will **delete** an existing AppSync API endpoint using the ```apiId``` specified in the custom section of ```serverless.yml``` under ```appSync```.

---

> If the ```apiId``` you are trying to update or delete does not exist, an error will be thrown. Login to your AWS AppSync dashboard; retrieve the API ID that you are trying to update or delete, and set it as the ```apiId``` in ```serverless.yml```

```
custom:
  appSync:
    apiId: xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 📝 Notes

* If you are planning on using <a target="_blank" href="https://aws.amazon.com/elasticsearch-service">AWS Elastic Search</a>, you will need to create an Elastic Search domain/endpoint on AWS and set it as the ```endpoint``` option in  ```serverless.yml``` **before** deploying.

## 🎁 Contributing

If you have any questions, please feel free to reach out to me directly on Twitter <a target="_blank" href="https://twitter.com/sidg_sid">Sid Gupta</a>.


## ❤️ Credits

Big Thanks to <a target="_blank" href="https://twitter.com/nikgraf">Nik Graf</a>, <a target="_blank" href="https://twitter.com/pmmuens">Philipp Müns</a>, <a target="_blank" href="https://twitter.com/superpatell">Jon Patel</a> and my favourite <a target="_blank" href="https://twitter.com/lolcoolkat">coolest kat ever</a> for helping to build this plugin!

We are always looking for open source contributions. So, feel free to create issues/contribute to this repo.
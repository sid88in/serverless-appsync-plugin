# serverless-appsync-plugin

![appsync architecture](https://user-images.githubusercontent.com/1587005/36063617-fe8d4e5e-0e33-11e8-855b-447513ba7084.png)

# Steps to use this plugin:

*Step 1*

In your root directory, install this plugin:

```yml
yarn add serverless-appsync-plugin
```

*Step 2*

Create schema.graphql

*Step 3*

Add custom config to serverless.yml:

```yaml
plugins:
   - serverless-appsync-plugin

custom:
  accountId: abc
  appSync:
    name:  # defaults to api
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

**NOTE** Please create data sources and other resources in serverless.yml file
**NOTE** if you are planning on using elastic search, for the time being you'll need to create a domain separately to obtain an ElasticSearch endpoint config once it is ready ***before the next step***


# Contributions:

If you have any questions, please feel free to reach out to me directly on twitter [Sid Gupta](https://twitter.com/sidg_sid).

Big Thanks! [Nik Graf](https://twitter.com/nikgraf), [Philipp Müns](https://twitter.com/pmmuens) and [Jon Patel](https://twitter.com/superpatell) for helping to build this plugin.

We are always looking for open source contributions. So, feel free to create issues/contribute to this repo.

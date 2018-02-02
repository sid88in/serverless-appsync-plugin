# serverless-appsync-plugin
serverless plugin for appsync

# Todo: Steps to use this plugin:

```
plugins:
   - serverless-appsync-plugin

custom:
   appsync:
     name:  # defaults to api
     authenticationType: API_KEY | AWS_IAM | AMAZON_COGNITO_USER_POOLS # required
     region: # defaults to provider region
     mappingTemplates: 
     schema: # defaults schema.graphql
     serviceRole: # required
     dataSources:
        name:
          type: AWS_LAMBDA | AMAZON_DYNAMODB | AMAZON_ELASTICSEARCH
          config:
             tableName: 'Users' # required
```
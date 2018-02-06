# serverless-appsync-plugin
serverless plugin for appsync

# Contributions:

Please feel free to reach out to me directly on twitter (@sidg_sid) if you have any questions

Big Thanks! Nik Graf (@nikgraf), Philipp Müns (@pmmuens) and Jon Patel (@superpatell) to help build this plugin.

We are always looking for more and more open source contributions, feel free to create issues/contribute to this repo.

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
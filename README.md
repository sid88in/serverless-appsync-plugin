# serverless-appsync-plugin
serverless plugin for appsync

# Steps to use this plugin:

1) cd SOME_SERVERLESS_APP_FOLDER
2) add schema.graphql (GraphQL SDL format)
2) Add custom config to serverless.yml:

```yaml
plugins:
   - serverless-appsync-plugin

custom:
  accountId: 1234567...
  appsync:
    name:  # defaults to api
    authenticationType: AMAZON_COGNITO_USER_POOLS # | API_KEY | AWS_IAM # required
    userPoolConfig:
      awsRegion: # required - example: us-REGION-1
      defaultAction: # required - example: ALLOW
      userPoolId: # required - example: us-east-1_ABCD1234
    # region: # defaults to provider region
    # mappingTemplates: # defaults to mapping-templates
    schema: # defaults to schema.graphql
    serviceRole: # required - example: "arn:aws:iam::${self:custom.accountId}:role/EXAMPLE-Role"
    dataSources:
      - type: AMAZON_DYNAMODB
        name: Users
        description: 'Users table'
        config:
           tableName: 'Users'
```

3) npm install --save serverless-appsync-plugin
4) serverless deploy
5) serverless deploy-appsync

# Contributions:

If you have any questions, please feel free to reach out to me directly on twitter (@sidg_sid).

Big Thanks! Nik Graf (@nikgraf), Philipp Müns (@pmmuens) and Jon Patel (@superpatell) for helping to build this plugin.

We are always looking for open source contributions. So, feel free to create issues/contribute to this repo.

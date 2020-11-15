This serverless plugin is a wrapper for [amplify-appsync-simulator](https://github.com/aws-amplify/amplify-cli/tree/master/packages/amplify-appsync-simulator) made for testing AppSync APIs built with [serverless-appsync-plugin](https://github.com/sid88in/serverless-appsync-plugin).


# Requires
- [serverless framework](https://github.com/serverless/serverless)
- [serverless-appsync-plugin](https://github.com/sid88in/serverless-appsync-plugin)
- [serverless-offline](https://github.com/dherault/serverless-offline)
- [serverless-dynamodb-local](https://github.com/99xt/serverless-dynamodb-local) (when using dynamodb resolvers only)

# Install

````bash
npm install serverless-appsync-simulator
# or
yarn add serverless-appsync-simulator
````

# Usage

This plugin relies on your serverless yml file and on the `serverless-offline` plugin.

````yml
plugins:
  - serverless-dynamodb-local # only if you need dynamodb resolvers and you don't have an external dynamodb
  - serverless-appsync-simulator
  - serverless-offline
````

**Note:** Order is important `serverless-appsync-simulator` must go **before** `serverless-offline`

To start the simulator, run the following command:
````bash
sls offline start
````

You should see in the logs something like:

````bash
...
Serverless: AppSync endpoint: http://localhost:20002/graphql
Serverless: GraphiQl: http://localhost:20002
...
````

# Configuration

Put options under `custom.appsync-simulator` in your `serverless.yml` file

| option                   | default               | description                                                                                                                                                         |
|--------------------------|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| apiKey                   | `0123456789`          | When using `API_KEY` as authentication type, the key to authenticate to the endpoint.                                                                               |
| port                     | 20002                 | AppSync operations port                                                                                                                                             |
| wsPort                   | 20003                 | AppSync subscriptions port                                                                                                                                          |
| location                 | . (base directory)    | Location of the lambda functions handlers.                                                                                                                          |
| lambda.loadLocalEnv      | false                 | If `true`, all environment variables (`$ env`) will be accessible from the resolver function. Read more in section [Environment variables](#environment-variables). |
| refMap                   | {}                    | A mapping of [resource resolutions](#resource-cloudformation-functions-resolution) for the `Ref` function                                                           |
| getAttMap                | {}                    | A mapping of [resource resolutions](#resource-cloudformation-functions-resolution) for the `GetAtt` function                                                        |
| importValueMap           | {}                    | A mapping of [resource resolutions](#resource-cloudformation-functions-resolution) for the `ImportValue` function                                                   |
| functions                | {}                    | A mapping of [external functions](#functions) for providing invoke url for external fucntions                                                                                |
| dynamoDb.endpoint        | http://localhost:8000 | Dynamodb endpoint. Specify it if you're not using serverless-dynamodb-local. Otherwise, port is taken from dynamodb-local conf                                      |
| dynamoDb.region          | localhost             | Dynamodb region. Specify it if you're connecting to a remote Dynamodb intance.                                                                                      |
| dynamoDb.accessKeyId     | DEFAULT_ACCESS_KEY    | AWS Access Key ID to access DynamoDB                                                                                                                                |
| dynamoDb.secretAccessKey | DEFAULT_SECRET        | AWS Secret Key to access DynamoDB                                                                                                                                   |

Example:

````yml
custom:
  appsync-simulator:
    location: '.webpack/service' # use webpack build directory
    dynamoDb:
      endpoint: 'http://my-custom-dynamo:8000'

````

# Resource CloudFormation functions resolution

This plugin supports *some* resources resolution from the `Ref`, `Fn::GetAtt` and `Fn::ImportValue` functions
in your yaml file. It also supports *some* other Cfn functions such as `Fn::Join`, `Fb::Sub`, etc.

**Note:** Under the hood, this features relies on the [cfn-resolver-lib](https://github.com/robessog/cfn-resolver-lib) package. For more info on supported cfn functions, refer to [the documentation](https://github.com/robessog/cfn-resolver-lib/blob/master/README.md)

## Basic usage

You can reference resources in your functions' environment variables (that will be accessible from your lambda functions) or datasource definitions.
The plugin will automatically resolve them for you.

````yaml
provider:
  environment:
    BUCKET_NAME:
      Ref: MyBucket # resolves to `my-bucket-name`

resources:
  Resources:
    MyDbTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: myTable
      ...
    MyBucket:
      Type: AWS::S3::Bucket
      Properties:
        BucketName: my-bucket-name
    ...

# in your appsync config
dataSources:
  - type: AMAZON_DYNAMODB
    name: dynamosource
    config:
      tableName:
        Ref: MyDbTable # resolves to `myTable`
````

## Override (or mock) values

Sometimes, some references **cannot** be resolved, as they come from an *Output* from Cloudformation; or you might want to use mocked values in your local environment.

In those cases, you can define (or override) those values using the `refMap`, `getAttMap` and `importValueMap` options.

- `refMap` takes a mapping of *resource name* to *value* pairs
- `getAttMap` takes a mapping of *resource name* to *attribute/values* pairs
- `importValueMap` takes a mapping of *import name* to *values* pairs

Example:

````yaml
custom:
  serverless-appsync-simulator:
    refMap:
      # Override `MyDbTable` resolution from the previous example.
      MyDbTable: 'mock-myTable'
    getAttMap:
      # define ElasticSearchInstance DomainName
      ElasticSearchInstance:
        DomainEndpoint: "localhost:9200"
    importValueMap:
      other-service-api-url: "https://other.api.url.com/graphql"

# in your appsync config
dataSources:
  - type: AMAZON_ELASTICSEARCH
    name: elasticsource
    config:
      # endpoint resolves as 'http://localhost:9200'
      endpoint:
        Fn::Join:
          - ""
          - - https://
            - Fn::GetAtt:
                - ElasticSearchInstance
                - DomainEndpoint
````

### Key-value mock notation

In some special cases you will need to use key-value mock nottation.
Good example can be case when you need to include serverless stage value (`${self:provider.stage}`) in the import name.

*This notation can be used with all mocks - `refMap`, `getAttMap` and `importValueMap`*

```yaml
provider:
  environment:
    FINISH_ACTIVITY_FUNCTION_ARN:
      Fn::ImportValue: other-service-api-${self:provider.stage}-url

custom:
  serverless-appsync-simulator:
    importValueMap:
      - key: other-service-api-${self:provider.stage}-url
        value: "https://other.api.url.com/graphql"
```

## Environment variables

```yaml
custom:
  appsync-simulator:
    lambda:
      loadLocalEnv: true
```

If `true`, all environment variables (`$ env`) will be accessible from the resolver function.

If `false`, only environment variables defined in `serverless.yml` will be accessible from the resolver function.

> _Note: `serverless.yml` environment variables have higher priority than local environment variables.  Thus some of your local environment variables, could get overridden by environment variables from `serverless.yml`._

## Limitations

This plugin only tries to resolve the following parts of the yml tree:
- `provider.environment`
- `functions[*].environment`
- `custom.appSync`

If you have the need of resolving others, feel free to open an issue and explain your use case.

For now, the supported resources to be automatically resovled by `Ref:` are:
- DynamoDb tables
- S3 Buckets

Feel free to open a PR or an issue to extend them as well.

# External functions
When a function is not defined withing the current serverless file you can still call it by providing an invoke url which should point to a REST method (must be post).

```yaml
custom:
  appsync-simulator:
    functions:
      addUser:
        url: http://localhost:3016/2015-03-31/functions/addUser/invocations
      addPost:
        url: https://jsonplaceholder.typicode.com/posts
```


# Supported Resolver types

This plugin supports resolvers implemented by `amplify-appsync-simulator`, as well as custom resolvers.

**From Aws Amplify:**
- NONE
- AWS_LAMBDA
- AMAZON_DYNAMODB
- PIPELINE

**Implemented by this plugin**
- AMAZON_ELASTIC_SEARCH
- HTTP

**Not Supported / TODO**
- RELATIONAL_DATABASE

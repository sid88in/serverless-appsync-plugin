[![Build Status](https://travis-ci.org/sid88in/serverless-appsync-plugin.svg?branch=master)](https://travis-ci.org/sid88in/serverless-appsync-plugin)
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-58-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Deploy [AppSync](https://aws.amazon.com/appsync) API's in minutes using this [Serverless](https://www.serverless.com/) plugin.

## Getting Started

Be sure to check out all that [AWS AppSync](https://aws.amazon.com/appsync) has to offer. Here are a few resources to help you understand everything needed to get started!

* [Mapping Templates](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference.html) - Not sure how to create Mapping Templates for **DynamoDB**, **Lambda** or **Elasticsearch**? Here's a great place to start!
* [Data Sources and Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/tutorials.html) - Get more information on what data sources are supported and how to set them up!
* [Security](https://docs.aws.amazon.com/appsync/latest/devguide/security.html) - Checkout this guide to find out more information on securing your API endpoints with AWS_IAM or Cognito User Pools!

## Minimum requirements

* [Node.js v8 or higher](https://nodejs.org)
* [Serverless v1.30.0 or higher](https://github.com/serverless/serverless)

## Installation & Configuration

Install the plugin via [Yarn](https://yarnpkg.com/lang/en/docs/install/)

```
yarn add serverless-appsync-plugin
```

or via [NPM](https://docs.npmjs.com/cli/install)

```
npm install serverless-appsync-plugin
```

### Configuring the plugin

Add ```serverless-appsync-plugin``` to the plugins section of ```serverless.yml```

```
plugins:
   - serverless-appsync-plugin
```

Add the following config to the custom section of ```serverless.yml``` and update it accordingly to your needs

```yaml
custom:
  appSync:
    name:  # defaults to api
    # apiKey # only required for update-appsync/delete-appsync
    authenticationType: API_KEY or AWS_IAM or AMAZON_COGNITO_USER_POOLS or OPENID_CONNECT
    schema: # schema file or array of files to merge, defaults to schema.graphql
    # Caching options. Disabled by default
    # read more at https://aws.amazon.com/blogs/mobile/appsync-caching-transactions/
    # and https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-apicache.html
    caching:
      behavior: FULL_REQUEST_CACHING # or PER_RESOLVER_CACHING. Required
      ttl: 3600 # The TTL of the cache. Optional. Default: 3600
      atRestEncryption: # Bool, Optional. Enable at rest encryption. disabled by default.
      transitEncryption: # Bool, Optional. Enable transit encryption. disabled by default.
      type: 'T2_SMALL' # Cache instance size. Optional. Default: 'T2_SMALL'
    # if AMAZON_COGNITO_USER_POOLS
    userPoolConfig:
      awsRegion: # defaults to provider region
      defaultAction: # required # ALLOW or DENY
      userPoolId: # required # user pool ID
      appIdClientRegex: # optional
    # if OPENID_CONNECT
    openIdConnectConfig:
      issuer:
      clientId:
      iatTTL:
      authTTL:
    # Array of additional authentication providers
    additionalAuthenticationProviders:
      - authenticationType: API_KEY
      - authenticationType: AWS_IAM
      - authenticationType: OPENID_CONNECT
        openIdConnectConfig:
          issuer:
          clientId:
          iatTTL:
          authTTL:
      - authenticationType: AMAZON_COGNITO_USER_POOLS
        userPoolConfig:
          awsRegion: # defaults to provider region
          userPoolId: # required # user pool ID
          appIdClientRegex: # optional
    logConfig:
      loggingRoleArn: { Fn::GetAtt: [AppSyncLoggingServiceRole, Arn] } # Where AppSyncLoggingServiceRole is a role with CloudWatch Logs write access
      level: ERROR # Logging Level: NONE | ERROR | ALL
      excludeVerboseContent: false
    defaultMappingTemplates: # default templates. Useful for Lambda templates that are often repetitive. Will be used if the template is not specified in a resolver
      request: my.request.template.tpl # or, e.g: false for Direct lambdas
      response: my.response.template.tpl # or e.g.: false for Direct lambdas
    mappingTemplatesLocation: # defaults to mapping-templates
    mappingTemplates:
      - dataSource: # data source name
        type: # type name in schema (e.g. Query, Mutation, Subscription, or a custom type e.g. User)
        field: getUserInfo
        # kind: UNIT (default, not required) or PIPELINE (required for pipeline resolvers)
        functions: # array of functions if kind === 'PIPELINE'
          - # function name
        request: # request mapping template name | defaults to `defaultMappingTemplates.request` or {type}.{field}.request.vtl
        response: # response mapping template name | defaults to `defaultMappingTemplates.response` or {type}.{field}.response.vtl
        # When caching is enaled with `PER_RESOLVER_CACHING`,
        # the caching options of the resolver.
        # Disabled by default.
        # Accepted values:
        # - `true`: cache enabled with global `ttl` and default `keys`
        # - an object with the following keys:
        #    - ttl: The ttl of this particular resolver. Optional. Defaults to global ttl
        #    - keys: The keys to use for the cache. Optionnal. Defaults to a hash of the
        #            $context.arguments and $context.identity
        caching:
          keys: # array. A list of VTL variables to use as cache key.
            - "$context.identity.sub"
            - "$context.arguments.id"
          ttl: 1000 # override the ttl for this resolver. (default comes from global config)
        # When versioning is enabled with `versioned` on the datasource,
        # the datasync options of the resolver.
        # Disabled by default.
        # Accepted values:
        # - `true`: sync enabled with default ConflictDetection VERSION
        # - an object with the following keys:
        #    - conflictDetection: The Conflict Detection strategy to use.
        #    - functionName: The function name in your serverless.yml. Ignored if lambdaFunctionArn is provided.
        #    - lambdaFunctionArn: The Arn for the Lambda function to use as the Conflict Handler.
        #    - conflictHandler: The Conflict Resolution strategy to perform in the event of a conflict.
        sync:
          conflictDetection: VERSION # https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-resolver-syncconfig.html
          conflictHandler: OPTIMISTIC_CONCURRENCY # when not using lambda conflict handler choose The Conflict Resolution strategy to perform in the event of a conflict. OPTIMISTIC_CONCURRENCY / AUTOMERGE / LAMBDA
          functionName: graphql # The function name in your serverless.yml. Ignored if lambdaFunctionArn is provided.
          lambdaFunctionArn: "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:myFunction"

      - ${file({fileLocation}.yml)} # link to a file with arrays of mapping templates
    functionConfigurationsLocation: # defaults to mappingTemplatesLocation (mapping-templates)
    functionConfigurations:
      - name: # function name
        dataSource: # data source name
        request: # request mapping template name | defaults to {name}.request.vtl
        response: # reponse mapping template name | defaults to {name}.response.vtl
    dataSources:
      - type: NONE
        name: none
      - type: AMAZON_DYNAMODB
        name: # data source name
        description: # DynamoDB Table Description
        config:
          tableName: { Ref: MyTable } # Where MyTable is a dynamodb table defined in Resources
          serviceRoleArn: { Fn::GetAtt: [AppSyncDynamoDBServiceRole, Arn] } # Where AppSyncDynamoDBServiceRole is an IAM role defined in Resources
          iamRoleStatements: # custom IAM Role statements for this DataSource. Ignored if `serviceRoleArn` is present. Auto-generated if both `serviceRoleArn` and `iamRoleStatements` are omitted
            - Effect: "Allow"
              Action:
                - "dynamodb:GetItem"
              Resource:
                - "arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:myTable"
                - "arn:aws:dynamodb:{REGION}:{ACCOUNT_ID}:myTable/*"
          # Versioned DataSource configuration
          versioned: false # (default, not required)
          # When you enable versioning on a DynamoDB data source, you specify the following fields
          # read more at https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-datasource-deltasyncconfig.html
          # deltaSyncConfig:
          #   baseTableTTL: 0 # (default, not required) # The amount of time (in minutes) items should be kept in the base table when deleted. Set to 0 to delete items in the base table immediately
          #   deltaSyncTableName: { Ref: MyTableDelta } # required # The Delta Sync table name
          #   deltaSyncTableTTL: 60 # (default, not required) # The amount of time (in minutes) the delta sync table will keep track of changes

          region: # Overwrite default region for this data source
      - type: RELATIONAL_DATABASE
        name: # data source name
        description: # data source description
        config:
          dbClusterIdentifier: { Ref: RDSCluster } # The identifier for RDSCluster. Where RDSCluster is the cluster defined in Resources
          awsSecretStoreArn: { Ref: RDSClusterSecret } # The RDSClusterSecret ARN. Where RDSClusterSecret is the cluster secret defined in Resources
          serviceRoleArn: { Fn::GetAtt: [RelationalDbServiceRole, Arn] } # Where RelationalDbServiceRole is an IAM role defined in Resources
          databaseName: # optional database name
          schema: # optional database schema
          iamRoleStatements: # custom IAM Role statements for this DataSource. Ignored if `serviceRoleArn` is present. Auto-generated if both `serviceRoleArn` and `iamRoleStatements` are omitted
            - Effect: "Allow"
              Action:
                - "rds-data:DeleteItems"
                - "rds-data:ExecuteSql"
                - "rds-data:ExecuteStatement"
                - "rds-data:GetItems"
                - "rds-data:InsertItems"
                - "rds-data:UpdateItems"
              Resource:
                - "arn:aws:rds:{REGION}:{ACCOUNT_ID}:cluster:mydbcluster"
                - "arn:aws:rds:{REGION}:{ACCOUNT_ID}:cluster:mydbcluster:*"
            - Effect: "Allow"
              Action:
                - "secretsmanager:GetSecretValue"
              Resource:
                - "arn:aws:secretsmanager:{REGION}:{ACCOUNT_ID}:secret:mysecret"
                - "arn:aws:secretsmanager:{REGION}:{ACCOUNT_ID}:secret:mysecret:*"

          region: # Overwrite default region for this data source
      - type: AMAZON_ELASTICSEARCH
        name: # data source name
        description: 'ElasticSearch'
        config:
          domain: # a reference to a resource of type `AWS::Elasticsearch::Domain`
          endpoint: # required if `domain` not provided. Ex: "https://{XXX}.{REGION}.es.amazonaws.com"
          serviceRoleArn: { Fn::GetAtt: [AppSyncESServiceRole, Arn] } # Where AppSyncESServiceRole is an IAM role defined in Resources
          iamRoleStatements: # custom IAM Role statements for this DataSource. Ignored if `serviceRoleArn` is present. Auto-generated if both `serviceRoleArn` and `iamRoleStatements` are omitted
            - Effect: "Allow"
              Action:
                - "es:ESHttpGet"
              Resource:
                - "arn:aws:es:{REGION}:{ACCOUNT_ID}:{DOMAIN}"
      - type: AWS_LAMBDA
        name: # data source name
        description: 'Lambda DataSource'
        config:
          functionName: graphql # The function name in your serverless.yml. Ignored if lambdaFunctionArn is provided.
          lambdaFunctionArn: { Fn::GetAtt: [GraphqlLambdaFunction, Arn] } # Where GraphqlLambdaFunction is the lambda function cloudformation resource created by serverless for the serverless function named graphql
          serviceRoleArn: { Fn::GetAtt: [AppSyncLambdaServiceRole, Arn] } # Where AppSyncLambdaServiceRole is an IAM role defined in Resources
          iamRoleStatements: # custom IAM Role statements for this DataSource. Ignored if `serviceRoleArn` is present. Auto-generated if both `serviceRoleArn` and `iamRoleStatements` are omitted
            - Effect: "Allow"
              Action:
                - "lambda:invokeFunction"
              Resource:
                - "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:myFunction"
                - "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:myFunction:*"
      - type: HTTP
        name: # data source name
        description: 'Http endpoint'
        config:
          endpoint: # required # "https://{DOMAIN}/{PATH}"
      - ${file({dataSources}.yml)} # link to a file with an array or object of datasources
    substitutions: # allows to pass variables from here to velocity templates
      # ${exampleVar1} will be replaced with given value in all mapping templates
      exampleVar1: "${self:service.name}"
      exampleVar2: {'Fn::ImportValue': 'Some-external-stuff'}
    xrayEnabled: true # Bool, Optional. Enable X-Ray. disabled by default.
    tags: # Tags to be added to AppSync
      key1: value1
      key2: value2
```

> Be sure to replace all variables that have been commented out, or have an empty value.

#### Multiple APIs

If you have multiple APIs and do not want to split this up into another CloudFormation stack, simply change the `appSync` configuration property from an object into an array of objects:

```yaml
custom:
  appSync:
    - name: private-appsync-endpoint
      schema: AppSync/schema.graphql # or something like AppSync/private/schema.graphql
      authenticationType: OPENID_CONNECT
      openIdConnectConfig:
      ...
      serviceRole: AuthenticatedAppSyncServiceRole
      dataSources:
      ...
      mappingTemplatesLocation: ...
      mappingTemplates:
      ...
    - name: public-appsync-endpoint
      schema: AppSync/schema.graphql # or something like AppSync/public/schema.graphql
      authenticationType: API_KEY
      serviceRole: PublicAppSyncServiceRole
      dataSources:
      ...
      mappingTemplatesLocation: ...
      mappingTemplates:
      ...
```

> Note: CloudFormation stack outputs and logical IDs will be changed from the defaults to api name prefixed. This allows you to differentiate the APIs on your stack if you want to work with multiple APIs.

#### Pipeline Resolvers

Amazon supports [pipeline resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/pipeline-resolvers.html)

They allow you to perform more than one mapping template in sequence, so you can do multiple queries to multiple sources.
These queries are called function configurations ('AWS::AppSync::FunctionConfiguration') and are children of a resolver.

Here is an example of how to configure a resolver with function configurations.
The key here is to provide a 'kind' of 'PIPELINE' to the mapping template of the parent resolver.
Then provide the names of the functions in the mappingTemplate to match the names of the functionConfigurations.

```yml
custom:
  appSync:
    mappingTemplates:
      - type: Query
        field: testPipelineQuery
        request: './mapping-templates/before.vtl' # the pipeline's "before" mapping template, defaults to {type}.{field).request.vtl
        response: './mapping-templates/after.vtl' # the pipeline's "after" mapping template, defaults to {type}.{field}.response.vtl
        kind: PIPELINE
        functions:
          - authorizeFunction
          - fetchDataFunction
    functionConfigurations:
      - dataSource: graphqlLambda
        name: 'authorizeFunction'
        request: './mapping-templates/authorize-request.vtl' # defaults to {name}.request.vtl
        response: './mapping-templates/common-response.vtl' # defaults to {name}.response.vtl
      - dataSource: dataTable
        name: 'fetchDataFunction'
        request: './mapping-templates/fetchData.vtl' # defaults to {name}.request.vtl
        response: './mapping-templates/common-response.vtl' # defaults to {name}.response.vtl
```

## Cli Usage

### `serverless deploy`

This command will deploy all AppSync resources in the same CloudFormation template used by the other serverless resources.

* Providing the `--conceal` option will conceal the API keys from the output when the authentication type of `API_KEY` is used.

### `validate-schema`

Validates your GraphQL Schema(s) without deploying.

### `serverless graphql-playground`

This command will start a local graphql-playground server which is connected to your deployed AppSync endpoint (in the cloud). The required options for the command are different depending on your AppSync authenticationType.

For API_KEY, either the GraphQLApiKeyDefault output or the --apiKey option is required

For AMAZON_COGNITO_USER_POOLS, the -u/--username and -p/--password arguments are required. The cognito user pool client id can be provided with the --clientId option or directly in the yaml file (```custom.appSync.userPoolConfig.playgroundClientId```)

For OPENID_CONNECT, the --jwtToken option is required.

The AWS_IAM authenticationType is not currently supported.

## Offline support

There are 2 ways to work with offline development for serverless appsync.

### serverless-appsync-simulator

[serverless-appsync-simulator](https://github.com/bboure/serverless-appsync-simulator) is a wrapper of aws's [amplify-cli](https://github.com/aws-amplify/amplify-cli) for serverless and this plugin. Both are actively maintained.

### serverless-appsync-simulator (deprecated/unmaintained)

[serverless-appsync-offline](https://github.com/aheissenberger/serverless-appsync-offline) is based on [AppSync Emulator](https://github.com/ConduitVC/aws-utils/tree/appsync/packages/appsync-emulator-serverless). Both these packages are currently unmaintained.


## Split Stacks Plugin

You can use [serverless-plugin-split-stacks](https://github.com/dougmoscrop/serverless-plugin-split-stacks) to migrate AppSync resources in nested stacks in order to work around the [~~200~~](~~) 500 resource limit.

1. Install [serverless-plugin-split-stacks](https://github.com/dougmoscrop/serverless-plugin-split-stacks)

```
yarn add --dev serverless-plugin-split-stacks
# or
npm install --save-dev serverless-plugin-split-stacks
```

2. Follow the `serverless-plugin-split-stacks` installation instructions

3. Place `serverless-plugin-split-stacks` after `serverless-appsync-plugin`

```yml
plugins:
  - serverless-appsync-plugin
  - serverless-plugin-split-stacks
```

4. Create `stacks-map.js` in the root folder

```js
module.exports = {
  'AWS::AppSync::ApiKey': { destination: 'AppSync', allowSuffix: true },
  'AWS::AppSync::DataSource': { destination: 'AppSync', allowSuffix: true },
  'AWS::AppSync::FunctionConfiguration': { destination: 'AppSync', allowSuffix: true },
  'AWS::AppSync::GraphQLApi': { destination: 'AppSync', allowSuffix: true },
  'AWS::AppSync::GraphQLSchema': { destination: 'AppSync', allowSuffix: true },
  'AWS::AppSync::Resolver': { destination: 'AppSync', allowSuffix: true }
}
```

5. Enjoy :beers:

## Contributing

If you have any questions, issue, feature request, please feel free to [open an issue](/issues/new).

You are also very welcome to open a PR and we will gladely review it.

## Resources

### Video tutorials
- [Building an AppSync + Serverless Framework Backend | FooBar](https://www.youtube.com/watch?v=eTUYqI_LCQ4)


### Blog tutorial

- *Part 1:* [Running a scalable & reliable GraphQL endpoint with Serverless](https://serverless.com/blog/running-scalable-reliable-graphql-endpoint-with-serverless/)

- *Part 2:* [AppSync Backend: AWS Managed GraphQL Service](https://medium.com/@sid88in/running-a-scalable-reliable-graphql-endpoint-with-serverless-24c3bb5acb43)

- *Part 3:* [AppSync Frontend: AWS Managed GraphQL Service](https://hackernoon.com/running-a-scalable-reliable-graphql-endpoint-with-serverless-db16e42dc266)

- *Part 4:* [Serverless AppSync Plugin: Top 10 New Features](https://medium.com/hackernoon/serverless-appsync-plugin-top-10-new-features-3faaf6789480)

## Contributors ✨

Thanks goes to these wonderful people :clap:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/bboure"><img src="https://avatars0.githubusercontent.com/u/7089997?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Benoît Bouré</b></sub></a><br /><a href="#maintenance-bboure" title="Maintenance">🚧</a> <a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=bboure" title="Code">💻</a></td>
    <td align="center"><a href="https://twitter.com/mrsanfran2"><img src="https://avatars2.githubusercontent.com/u/1587005?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Siddharth Gupta</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=sid88in" title="Code">💻</a></td>
    <td align="center"><a href="https://twitter.com/nikgraf"><img src="https://avatars1.githubusercontent.com/u/223045?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nik Graf</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=nikgraf" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Foosballfan"><img src="https://avatars3.githubusercontent.com/u/15104463?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Charles Killer</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=Foosballfan" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jpstrikesback"><img src="https://avatars3.githubusercontent.com/u/445563?v=4?s=100" width="100px;" alt=""/><br /><sub><b>jpstrikesback</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=jpstrikesback" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/zy"><img src="https://avatars1.githubusercontent.com/u/284540?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ZY</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=zy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/francisu"><img src="https://avatars3.githubusercontent.com/u/944949?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Francis Upton IV</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=francisu" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/trilliput"><img src="https://avatars1.githubusercontent.com/u/807663?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ilya Shmygol</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=trilliput" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/maddijoyce"><img src="https://avatars2.githubusercontent.com/u/2224291?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Maddi Joyce</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=maddijoyce" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/sebflipper"><img src="https://avatars2.githubusercontent.com/u/144435?v=4?s=100" width="100px;" alt=""/><br /><sub><b>sebflipper</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=sebflipper" title="Code">💻</a></td>
    <td align="center"><a href="https://www.erezro.com/"><img src="https://avatars0.githubusercontent.com/u/26760571?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Erez Rokah</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=erezrokah" title="Code">💻</a></td>
    <td align="center"><a href="https://www.twitter.com/deadcoder0904"><img src="https://avatars1.githubusercontent.com/u/16436270?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Akshay Kadam (A2K)</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=deadcoder0904" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/AntonShevel"><img src="https://avatars2.githubusercontent.com/u/5391187?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Anton</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=AntonShevel" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/hardchor"><img src="https://avatars0.githubusercontent.com/u/307162?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Burkhard Reffeling</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=hardchor" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/deankostomaj"><img src="https://avatars1.githubusercontent.com/u/3761480?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Dean Koštomaj</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=deankostomaj" title="Code">💻</a></td>
    <td align="center"><a href="https://blog.lesierse.com/"><img src="https://avatars0.githubusercontent.com/u/270232?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vincent Lesierse</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=vlesierse" title="Code">💻</a></td>
    <td align="center"><a href="https://riotz.works/"><img src="https://avatars3.githubusercontent.com/u/31102213?v=4?s=100" width="100px;" alt=""/><br /><sub><b>lulzneko</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=lulzneko" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/thomasmichaelwallace"><img src="https://avatars1.githubusercontent.com/u/1954845?v=4?s=100" width="100px;" alt=""/><br /><sub><b>thomas michael wallace</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=thomasmichaelwallace" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/c10h22"><img src="https://avatars3.githubusercontent.com/u/305888?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Adnene KHALFA</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=c10h22" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/roznalex"><img src="https://avatars0.githubusercontent.com/u/8004948?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alex Rozn</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=roznalex" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/kinyat"><img src="https://avatars0.githubusercontent.com/u/1476974?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Eric Chan</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=kinyat" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://josephle.me/"><img src="https://avatars1.githubusercontent.com/u/2822954?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Joseph</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=josephnle" title="Code">💻</a></td>
    <td align="center"><a href="http://miha.website/"><img src="https://avatars1.githubusercontent.com/u/142531?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Miha Eržen</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=mihaerzen" title="Code">💻</a></td>
    <td align="center"><a href="http://mike.fogel.ca/"><img src="https://avatars0.githubusercontent.com/u/69902?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mike Fogel</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=mfogel" title="Code">💻</a></td>
    <td align="center"><a href="https://philippmuens.com/"><img src="https://avatars3.githubusercontent.com/u/1606004?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Philipp Muens</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=pmuens" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/toxuin"><img src="https://avatars1.githubusercontent.com/u/868268?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Toxuin</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=toxuin" title="Code">💻</a></td>
    <td align="center"><a href="http://hypexr.org/"><img src="https://avatars1.githubusercontent.com/u/5427?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Scott Rippee</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=hypexr" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/yai333"><img src="https://avatars2.githubusercontent.com/u/29742643?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yi Ai</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=yai333" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/markvp"><img src="https://avatars2.githubusercontent.com/u/6936351?v=4?s=100" width="100px;" alt=""/><br /><sub><b>markvp</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=markvp" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/alexleonescalera"><img src="https://avatars2.githubusercontent.com/u/14811478?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alex</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=alexleonescalera" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/alexjurkiewicz"><img src="https://avatars0.githubusercontent.com/u/379509?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alex Jurkiewicz</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=alexjurkiewicz" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/anasqadrei"><img src="https://avatars1.githubusercontent.com/u/4755353?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Anas Qaderi</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=anasqadrei" title="Code">💻</a></td>
    <td align="center"><a href="http://www.heissenberger.at/"><img src="https://avatars2.githubusercontent.com/u/200095?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andreas Heissenberger</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=aheissenberger" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Mickael"><img src="https://avatars1.githubusercontent.com/u/32233?v=4?s=100" width="100px;" alt=""/><br /><sub><b>mickael</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=Mickael" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/btorresgil"><img src="https://avatars2.githubusercontent.com/u/4164289?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Brian Torres-Gil</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=btorresgil" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/cameroncf"><img src="https://avatars2.githubusercontent.com/u/789760?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Cameron Childress</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=cameroncf" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/cc07"><img src="https://avatars1.githubusercontent.com/u/26186634?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Chris Chiang</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=cc07" title="Code">💻</a></td>
    <td align="center"><a href="https://www.linkedin.com/in/siliconvalleynextgeneration/"><img src="https://avatars0.githubusercontent.com/u/1230575?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Esref Durna</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=EsrefDurna" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lkhari"><img src="https://avatars0.githubusercontent.com/u/3062396?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Hari</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=lkhari" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ivanbarlog"><img src="https://avatars2.githubusercontent.com/u/2583610?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ivan Barlog</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=ivanbarlog" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jveldboom"><img src="https://avatars2.githubusercontent.com/u/303202?v=4?s=100" width="100px;" alt=""/><br /><sub><b>John Veldboom</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=jveldboom" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bigluck"><img src="https://avatars2.githubusercontent.com/u/1511095?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Luca Bigon</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=bigluck" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://twitter.com/sketchingdev"><img src="https://avatars2.githubusercontent.com/u/31957045?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Lucas</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=SketchingDev" title="Code">💻</a></td>
    <td align="center"><a href="https://markpollmann.com/"><img src="https://avatars2.githubusercontent.com/u/5286559?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mark Pollmann</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=MarkPollmann" title="Code">💻</a></td>
    <td align="center"><a href="http://www.twitter.com/@morficus"><img src="https://avatars3.githubusercontent.com/u/718799?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Maurice Williams</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=morficus" title="Code">💻</a></td>
    <td align="center"><a href="http://www.cedar.ai/"><img src="https://avatars0.githubusercontent.com/u/1109028?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mike Chen</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=chensjlv" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/asnaseer-resilient"><img src="https://avatars1.githubusercontent.com/u/6410094?v=4?s=100" width="100px;" alt=""/><br /><sub><b>asnaseer-resilient</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=asnaseer-resilient" title="Code">💻</a></td>
    <td align="center"><a href="http://www.treadbook.com/"><img src="https://avatars3.githubusercontent.com/u/2530264?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Neal Clark</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=nealclark" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/moelholm"><img src="https://avatars2.githubusercontent.com/u/8393156?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nicky Moelholm</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=moelholm" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://patrick.wtf/"><img src="https://avatars1.githubusercontent.com/u/667029?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Patrick Arminio</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=patrick91" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/engineforce"><img src="https://avatars0.githubusercontent.com/u/3614365?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Paul Li</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=engineforce" title="Code">💻</a></td>
    <td align="center"><a href="https://conduit.vc/"><img src="https://avatars3.githubusercontent.com/u/322957?v=4?s=100" width="100px;" alt=""/><br /><sub><b>James Lal</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=lightsofapollo" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/thenengah"><img src="https://avatars2.githubusercontent.com/u/32788783?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Sam Gilman</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=thenengah" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/stefanceriu"><img src="https://avatars2.githubusercontent.com/u/637564?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Stefan Ceriu</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=stefanceriu" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/tsmith"><img src="https://avatars2.githubusercontent.com/u/339175?v=4?s=100" width="100px;" alt=""/><br /><sub><b>tsmith</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=tsmith" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/veloware"><img src="https://avatars1.githubusercontent.com/u/61578546?v=4?s=100" width="100px;" alt=""/><br /><sub><b>veloware</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=veloware" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/nadalfederer"><img src="https://avatars1.githubusercontent.com/u/6043510?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vladimir Lebedev</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=nadalfederer" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Znergy"><img src="https://avatars1.githubusercontent.com/u/18511689?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ryan Jones</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=Znergy" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

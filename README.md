[![Tests](https://github.com/sid88in/serverless-appsync-plugin/workflows/Tests/badge.svg)](https://github.com/sid88in/serverless-appsync-plugin/actions?query=workflow%3ATests) <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-61-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Deploy [AppSync](https://aws.amazon.com/appsync) API's in minutes using this [Serverless](https://www.serverless.com/) plugin.

# Getting Started

Be sure to check out all that [AWS AppSync](https://aws.amazon.com/appsync) has to offer. Here are a few resources to help you understand everything needed to get started!

* [Mapping Templates](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference.html) - Not sure how to create Mapping Templates for **DynamoDB**, **Lambda** or **Elasticsearch**? Here's a great place to start!
* [Data Sources and Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/tutorials.html) - Get more information on what data sources are supported and how to set them up!
* [Security](https://docs.aws.amazon.com/appsync/latest/devguide/security.html) - Checkout this guide to find out more information on securing your API endpoints with AWS_IAM or Cognito User Pools!

# Minimum requirements

* [Node.js v8 or higher](https://nodejs.org)
* [Serverless v1.30.0 or higher](https://github.com/serverless/serverless)

# Installation & Configuration

Install the plugin via [Yarn](https://yarnpkg.com/lang/en/docs/install/)

```
yarn add serverless-appsync-plugin
```

or via [NPM](https://docs.npmjs.com/cli/install)

```
npm install serverless-appsync-plugin
```

## Configuring the plugin

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
    # apiId # if provided, will update the specified API.
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

    apiKeys:
      - name: john # name of the api key
        description: 'My api key'
        expiresAfter: 30d # api key life time
      - name: jane
        description: "Jane's api key"
        expiresAt: '2021-03-09T16:00:00+00:00'
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
    wafConfig:
      enabled: true
      name: AppSyncWaf
      defaultAction: Allow # or Block. Defaults to Allow
      description: 'My AppSync Waf rules'
      rules:
        - throttle: 100
        - disableIntrospection
        - name: UsOnly
          action: Block # Allow, Block, or Count
          statement:
            NotStatement:
              Statement:
                GeoMatchStatement:
                  CountryCodes:
                    - US

    tags: # Tags to be added to AppSync
      key1: value1
      key2: value2
```

> Be sure to replace all variables that have been commented out, or have an empty value.

### Working with existing APIs

If you already have an API created in AppSync through the UI or from a different CF stack
and want to manage it via Serverless then the plugin can also support that.

There is an optional *apiId* parameter that you can use to specify the ID of an existing AppSync API:
```yaml
custom:
  appSync:
    # ...
    apiId: 1234abcd
    # ...
```
Without *apiId* parameter the plugin will create a different endpoint with the same name alongside the original one.


You can find the *apiId* value in the AppSync console, just open your existing AppSync API
and go to Settings.

In that case, the plugin will not attempt to create a new endpoint for you, instead, it will attach all newly configured resources to the
existing endpoint.

The following configuration options are only associated with the creation of a new AppSync endpoint
and will be ignored if you provide *apiId* parameter:

- name
- authenticationType
- caching
- userPoolConfig
- openIdConnectConfig
- additionalAuthenticationProviders
- logConfig
- tags

So later, if you wanted to change the name of the API, or add some tags, or change the logging configuration,
 anything from the list above you would have to do that via a different method, for example from the UI.

If the existing API already contains schema and resolvers those will be completely replaced by the new
schema and resolvers from the code.

If the existing API already contains data sources, those data sources will remain untouched unless they have the same
names as the data sources in the code, in which case they will be replaced with the ones from the code.

> **Note:** You should never set the apiId of an API that was previously deployed with the same serverless stack, otherwise, it would be deleted. That is because the resource would be removed from the stack.
>
> Only use the apiId parameter if you know what you are doing.

### Multiple APIs

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

> **Note:** CloudFormation stack outputs and logical IDs will be changed from the defaults to api name prefixed. This allows you to differentiate the APIs on your stack if you want to work with multiple APIs.

### Pipeline Resolvers

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

### Managing API keys

Since v1.5.0, api keys management is supported. You can pass one or more api keys configuration as an array in the `appSync.apiKeys` property.

The keys can either be a string (name of the key with defaults) or an object of the following shape:

|   property   |      default      | description|
|--------------| ------------------|------------|
| name         | *auto-generated*  | Name of the key. This is used under the hood to differentiate keys in the deployment process.<br/><br/>Names are used in the Cfn resource name. Please, keep them short and without spaces or special characters to avoid issues. Key names are case sensitive. |
| description  | *name of the key*   | A short description for that key |
| expiresAfter | 365d                | Expiration time for the key. <br/>Can be expressed in hours or in "human" format (As in momentjs [add](https://momentjscom.readthedocs.io/en/latest/moment/03-manipulating/01-add/)).<br/>eg: `24`, `30d`, `1M`, `2w`, `1y`<br/>Min: 1d, max: 1y |
| expiresAt      | *one year from now* | A specific expiration date in ISO 8601 format. Or as a unix timestamp |
| apiKeyId      | `undefined`      | the id if the api to update. Useful for when an api key has been created manually in the AWS console. |

If both `expiresAfter` and `expiresAt` are specified, `expiresAfter` takes precedence.

When naming keys, you need to be aware that changing the value will require the **replacement** of the api key.

Unnamed keys are named automatically sequentially Key1, Key2, Key3 and so forth.

:warning: **Be careful when removing unnamed keys!!!**. For exemple, if you have 3 unnamed keys and you remove the second one in your list, Key3 will become Key2. As a result, it is former Key3 that **will be removed**. To workaround that, you could specify their auto-generated names before removing any unnamed keys (Key1, Key2 and Key3 in our example. Then remove Key2). As a rule of thumb, all keys should be named to avoid issues.

:bulb: If you have already deployed and an api key was previously auto-generated for you (either in version <1.5.0 or if you deployed without specifying the `apiKeys` property), you can add it to your yml template by naming it `Default` (case sensitive!!). Starting from there, you can add additional API keys.

:bulb: If you want to revoke a key, delete it, or rename it.

:bulb: If a key expires, or you have manually deleted it from the cosole, subsequent deployments will fail (after 60 days in the case it expires). You can fix that by simply removing the key from your yml file, or by renaming it (in which case, a new key will be generated).

Example:
```yml
apiKeys:
  - name: Default # default API key. Use this name if you already have an auto-generated API key
    description: Default api key
    expires: 1y # 1 year timelife
  - Mark # inline named key, with defaults (1 year duration)
  - name: John
    description: John api key
    expires: 30d
  - name: Jane
    expires: 2d
  - description: Unnamed key # first unnamed key (Key1)
  - expires: 30d # second unnamed key (Key2)
  - name: ThrottledAPIKey
    wafRules:
      - throttle # throttle this API key to 100 requests per 5 min

  - name: GeoApiKey
    description: Us Only
    # Disallow this Api key outsite the US
    wafRules:
      - action: Block
        name: UsOnly
        statement:
          NotStatement:
            Statement:
              GeoMatchStatement:
                CountryCodes:
                  - US


```

:bulb:  Finally, if you dont't want serverless to handle keys for you, just pass an empty array:

```yml
# Handle keys manually in the aws console.
apiKeys: []
```

### WAF Web ACL

AppSync [supports WAF](https://aws.amazon.com/blogs/mobile/appsync-waf/). WAF is an Application Firewall that helps you protect your API against common web exploits.

This plugin comes with some handy pre-defined rules that you can enable in just a few lines of code.

### Throttling

Throttling will disallow requests coming from the same ip address when a limit is reached within a 5-minutes period.

There are several ways to enable it. Here are some examples:

````yml
wafConfig:
  enabled: true
  rules:
    - throttle # limit to 100 requests per 5 minutes period
    - throttle: 200 # limit to 200 requests per 5 minutes period
    - throttle:
        limit: 200
        priority: 10
        aggregateKeyType: FORWARDED_IP
        forwardedIPConfig:
          headerName: 'X-Forwarded-For'
          fallbackBehavior: 'MATCH'
````

### Disable Introspection

Sometimes, you want to disable introspection to disallow untrusted consumers to discover the structure of your API.

````yml
wafConfig:
  enabled: true
  rules:
    - disableIntrospection  # disables introspection for everyone
````

### Per Api Key rules

In some cases, you might want to enable a rule only for a given API key only. You can specify `wafRules` under the `apiKeys` configuration. The rules will apply only to the api key under which the rule is set.

````yml
apiKeys:
  - name: MyApiKey
    expiresAfter: 365d
    wafRules:
      - throttle # throttles this API key
      - disableIntrospection # disables introspection for this API key
````

Adding a rule to an API key without any _statement_ will add a "match-all" rule for that key.
This is usefull for example to exclude api keys from high-level rules. In that case, you need to make sure to attribute a higher priority to that rule.

Example:
- Block all requests by default
- Add a rule to allow US requests
- Except for the `WorldWideApiKey` key, that should have worldwide access.

````yml
wfConfig:
  enabled: true
  defaultAction: Block # Block all by default
  rules:
    # allow US requests
    - action: Allow
      name: UsOnly
      priority: 5
      statement:
        geoMatchStatement:
          countryCodes:
            - US
apiKeys:
  - name: Key1 # no rule is set, the top-level rule applies (Us only)
  - name: Key1 # no rule is set, the top-level rule applies (Us only)
  - name: WorldWideApiKey
    wafRules:
      - name: WorldWideApiKeyRule
        action: Allow
        priority: 1 # Make sure the priority is higher (lower number) to evaluate it first
````

### About priority

The priorities don't need to be consecutive, but they must all be different.

Setting a priority to the rules is not required, but recommended. If you don't set priority, it will be automatically attributed (sequentially) according to the following rules:

First the global rules (under `wafConfig.rules`), in the order that they are defined. Then, the api key rules, in order of api key definitions, then rule definition.
Auto-generated priorities start at 100. This gives you some room (0-99) to add other rules that should get a higher priority, if you need to.

For more info about how rules are executed, pease refer to [the documentation](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-processing.html)

Example:

````yml
wfConfig:
  enabled: true
  rules:
    - name: Rule1
      # (no-set) Priority = 100
    - name: Rule2
      priority: 5 # Priority = 5
    - name: Rule3
      # (no-set) Priority = 101
apiKeys:
  - name: Key1
    wafRules:
      - name: Rule4
        # (no-set) Priority = 102
      - name: Rule5
        # (no-set) Priority = 103
  - name: Key
    wafRules:
      - name: Rule6
        priority: 1 # Priority = 1
      - name: Rule7
        # (no-set) Priority = 104
````


### Advanced usage

You can also specify custom rules. For more info on how to define a rule, see the [Cfn documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-wafv2-webacl-rule.html)

Example:

````yml
wafConfig:
  enabled: true
  defaultAction: Block
  rules:
    # Only allow US users
    - action: Allow
      name: UsOnly
      statement:
        geoMatchStatement:
          countryCodes:
            - US
````

### Schema Comments
In some cases you want to enable usage of old-style comments (#) in appSync. setting the ``allowHashDescription`` setting
to true, will enable this.

Example:
```yml
custom:
  appSync:
    name:  # defaults to api
    allowHashDescription: true
    # ... other settings
```

# Cli Usage

## `serverless deploy`

This command will deploy all AppSync resources in the same CloudFormation template used by the other serverless resources.

* Providing the `--conceal` option will conceal the API keys from the output when the authentication type of `API_KEY` is used.

## `validate-schema`

Validates your GraphQL Schema(s) without deploying.

## `serverless graphql-playground`

This command will start a local graphql-playground server which is connected to your deployed AppSync endpoint (in the cloud). The required options for the command are different depending on your AppSync authenticationType.

For API_KEY, either the GraphQLApiKeyDefault output or the --apiKey option is required

For AMAZON_COGNITO_USER_POOLS, the -u/--username and -p/--password arguments are required. The cognito user pool client id can be provided with the --clientId option or directly in the yaml file (```custom.appSync.userPoolConfig.playgroundClientId```)

For OPENID_CONNECT, the --jwtToken option is required.

The AWS_IAM authenticationType is not currently supported.

# Offline support

There are 2 ways to work with offline development for serverless appsync.

## serverless-appsync-simulator

[serverless-appsync-simulator](https://github.com/bboure/serverless-appsync-simulator) is a wrapper of aws's [amplify-cli](https://github.com/aws-amplify/amplify-cli) for serverless and this plugin. Both are actively maintained.

## serverless-appsync-simulator (deprecated/unmaintained)

[serverless-appsync-offline](https://github.com/aheissenberger/serverless-appsync-offline) is based on [AppSync Emulator](https://github.com/ConduitVC/aws-utils/tree/appsync/packages/appsync-emulator-serverless). Both these packages are currently unmaintained.


# Split Stacks Plugin

You can use [serverless-plugin-split-stacks](https://github.com/dougmoscrop/serverless-plugin-split-stacks) to migrate AppSync resources in nested stacks in order to work around the [~~200~~](~~) 500 resource limit.

1. Install [serverless-plugin-split-stacks](https://github.com/dougmoscrop/serverless-plugin-split-stacks)

```
yarn add --dev serverless-plugin-split-stacks
 or
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

# Contributing

If you have any questions, issue, feature request, please feel free to [open an issue](/issues/new).

You are also very welcome to open a PR and we will gladely review it.

# Resources

## Video tutorials
- [Building an AppSync + Serverless Framework Backend | FooBar](https://www.youtube.com/watch?v=eTUYqI_LCQ4)


## Blog tutorial

- *Part 1:* [Running a scalable & reliable GraphQL endpoint with Serverless](https://serverless.com/blog/running-scalable-reliable-graphql-endpoint-with-serverless/)

- *Part 2:* [AppSync Backend: AWS Managed GraphQL Service](https://medium.com/@sid88in/running-a-scalable-reliable-graphql-endpoint-with-serverless-24c3bb5acb43)

- *Part 3:* [AppSync Frontend: AWS Managed GraphQL Service](https://hackernoon.com/running-a-scalable-reliable-graphql-endpoint-with-serverless-db16e42dc266)

- *Part 4:* [Serverless AppSync Plugin: Top 10 New Features](https://medium.com/hackernoon/serverless-appsync-plugin-top-10-new-features-3faaf6789480)

# Contributors ✨

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
    <td align="center"><a href="https://github.com/vicary"><img src="https://avatars0.githubusercontent.com/u/85772?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vicary A.</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=vicary" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bsantare"><img src="https://avatars2.githubusercontent.com/u/29000522?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Brian Santarelli</b></sub></a><br /><a href="#ideas-bsantare" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/EmiiFont"><img src="https://avatars.githubusercontent.com/u/4354709?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Emilio Font</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=EmiiFont" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

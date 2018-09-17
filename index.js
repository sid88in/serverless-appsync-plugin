const fs = require('fs');
const path = require('path');
const {
  validateSchema, printError, parse, buildASTSchema,
} = require('graphql');
const runPlayground = require('./graphql-playground');
const getConfig = require('./get-config');

const MIGRATION_DOCS = 'https://github.com/sid88in/serverless-appsync-plugin/blob/master/README.md#cfn-migration';
const RESOURCE_API = "GraphQLApi";
const RESOURCE_API_CLOUDWATCH_LOGS_ROLE = "GraphQlApiCloudWatchLogsRole";
const RESOURCE_API_KEY = "GraphQlApiKey";
const RESOURCE_SCHEMA = "GraphQlSchema";
const RESOURCE_URL = "GraphQlApiUrl";
const RESOURCE_RESOLVER = "GraphQlResolver";
const RESOURCE_DATASOURCE = "GraphQlDs";
const RESOURCE_DATASOURCE_ROLE = "GraphQlDsRole";

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.commands = {
      'delete-appsync': {
        usage: 'Helps you delete AppSync API',
        lifecycleEvents: ['delete'],
      },
      'graphql-playground': {
        usage: 'Runs a local graphql playground instance using your appsync config',
        options: {
          clientId: {
            usage: 'Specify your cognito client id (for AMAZON_COGNITO_USER_POOLS authType)',
            required: false,
          },
          username: {
            usage: 'Specify your username (for AMAZON_COGNITO_USER_POOLS authType)',
            shortcut: 'u',
            required: false,
          },
          password: {
            usage: 'Specify your password (for AMAZON_COGNITO_USER_POOLS authType)',
            shortcut: 'p',
            required: false,
          },
          jwtToken: {
            usage: 'Specify your jwtToken (for OPENID_CONNECT authType)',
            required: false,
          },
          apiKey: {
            usage: 'Specify your appsync api key (for API_KEY authType)',
            required: false,
          },
          port: {
            usage: 'Specify the local port graphql playground should run from',
            required: false,
          },
        },
        lifecycleEvents: ['run'],
      },
      'deploy-appsync': {
        usage: 'DEPRECATED: Helps you deploy AppSync API',
        lifecycleEvents: ['deploy'],
      },
      'update-appsync': {
        usage: 'DEPRECATED: Helps you update AppSync API',
        lifecycleEvents: ['update'],
      },
    };

    const generateMigrationErrorMessage = command => () => {
      throw new this.serverless.classes.Error(`serverless-appsync: ${command} `
        + `is no longer supported. See ${MIGRATION_DOCS} for more information`);
    };
    this.hooks = {
      'before:deploy:initialize': () => this.validateSchemas(),
      'delete-appsync:delete': () => this.deleteGraphQLEndpoint(),
      'graphql-playground:run': () => this.runGraphqlPlayground(),
      'deploy-appsync:deploy': generateMigrationErrorMessage('deploy-appsync'),
      'update-appsync:update': generateMigrationErrorMessage('update-appsync'),
      'before:deploy:deploy': () => this.addResources(),
    };
  }

  loadConfig() {
    return getConfig(
      this.serverless.service.custom.appSync,
      this.serverless.service.provider,
      this.serverless.config.servicePath,
    );
  }

  getSchemas() {
    const config = this.loadConfig();

    const awsTypes = `
      scalar AWSDate
      scalar AWSTime
      scalar AWSDateTime
      scalar AWSTimestamp
      scalar AWSEmail
      scalar AWSJSON
      scalar AWSURL
      scalar AWSPhone
      scalar AWSIPAddress
    `;

    return config.map(apiConfig => `${apiConfig.schema} ${awsTypes}`);
  }

  validateSchemas() {
    const schemas = this.getSchemas();
    const asts = schemas.map(schema => buildASTSchema(parse(schema)));
    const errors = asts.reduce((accumulatedErrors, currentAst) => {
      const currentErrors = validateSchema(currentAst);
      if (!currentErrors.length) {
        return accumulatedErrors;
      } else if (!accumulatedErrors.length) {
        return currentErrors;
      } else {
        return accumulatedErrors.concat(currentErrors || []);
      }
    });
    if (!errors.length) {
      return;
    }

    errors.forEach((error) => {
      this.serverless.cli.log(printError(error));
    });
    throw new this.serverless.classes.Error('Cannot proceed invalid graphql SDL in one or more schemas.');
  }

  deleteGraphQLEndpoint() {
    const config = this.loadConfig();
    return Promise.all(config.map(apiConfig => {
      const { apiId } = apiConfig;
      if (!apiId) {
        throw new this.serverless.classes.Error('serverless-appsync: no apiId is defined. If you are not '
          + `migrating from a previous version of the plugin this is expected.  See ${MIGRATION_DOCS} `
          + 'for more information');
      }

      this.serverless.cli.log('Deleting GraphQL Endpoint...');
      return this.provider
        .request('AppSync', 'deleteGraphqlApi', {
          apiId,
        })
        .then((data) => {
          if (data) {
            this.serverless.cli.log(`Successfully deleted GraphQL Endpoint: ${apiId}`);
          }
        });
    }));
  }

  runGraphqlPlayground() {
    // Use the first config or config map
    const config = this.loadConfig()[0];
    runPlayground(this.serverless.service, this.provider, config, this.options).then((url) => {
      this.serverless.cli.log(`Graphql Playground Server Running at: ${url}`);
    });
  }

  addResources() {
    const config = this.loadConfig();

    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const outputs = this.serverless.service.provider.compiledCloudFormationTemplate.Outputs;

    config.forEach(apiConfig => {
      if (apiConfig.apiId) {
        this.serverless.cli.log('WARNING: serverless-appsync has been updated in a breaking way and your '
          + 'service is configured using a reference to an existing apiKey in '
          + '`custom.appSync` which is used in the legacy deploy scripts. This deploy will create '
          + `new graphql resources and WILL NOT update your existing api. See ${MIGRATION_DOCS} for `
          + 'more information');
      }

      Object.assign(resources, this.getGraphQlApiEndpointResource(apiConfig));
      Object.assign(resources, this.getApiKeyResources(apiConfig));
      Object.assign(resources, this.getGraphQLSchemaResource(apiConfig));
      Object.assign(resources, this.getCloudWatchLogsRole(apiConfig));
      Object.assign(resources, this.getDataSourceIamRolesResouces(apiConfig));
      Object.assign(resources, this.getDataSourceResources(apiConfig));
      Object.assign(resources, this.getResolverResources(apiConfig));

      Object.assign(outputs, this.getGraphQlApiOutputs(apiConfig));
      Object.assign(outputs, this.getApiKeyOutputs(apiConfig));
    });
  }

  getGraphQlApiEndpointResource(config) {
    const cloudWatchLogsRoleLogicalId = this.getLogicalId(config, RESOURCE_API_CLOUDWATCH_LOGS_ROLE);
    return {
      [this.getLogicalId(config, RESOURCE_API)]: {
        Type: 'AWS::AppSync::GraphQLApi',
        Properties: {
          Name: config.name,
          AuthenticationType: config.authenticationType,
          UserPoolConfig: config.authenticationType !== 'AMAZON_COGNITO_USER_POOLS' ? undefined : {
            AwsRegion: config.region,
            DefaultAction: config.userPoolConfig.defaultAction,
            UserPoolId: config.userPoolConfig.userPoolId,
            AppIdClientRegex: config.userPoolConfig.appIdClientRegex,
          },
          OpenIDConnectConfig: config.authenticationType !== 'OPENID_CONNECT' ? undefined : {
            Issuer: config.openIdConnectConfig.issuer,
            ClientId: config.openIdConnectConfig.clientId,
            IatTTL: config.openIdConnectConfig.iatTTL,
            AuthTTL: config.openIdConnectConfig.authTTL,
          },
          LogConfig: !config.logConfig ? undefined : {
            CloudWatchLogsRoleArn:
              config.logConfig.loggingRoleArn || { "Fn::GetAtt": [cloudWatchLogsRoleLogicalId, "Arn"] },
            FieldLogLevel: config.logConfig.level,
          },
        },
      },
    };
  }

  getApiKeyResources(config) {
    if (config.authenticationType !== 'API_KEY') {
      return {};
    }
    return {
      [this.getLogicalId(config, RESOURCE_API_KEY)]: {
        Type: 'AWS::AppSync::ApiKey',
        Properties: {
          ApiId: { 'Fn::GetAtt': [this.getLogicalId(config, RESOURCE_API), 'ApiId'] },
          Description: `serverless-appsync-plugin: AppSync API Key for ${this.getLogicalId(config, RESOURCE_API_KEY)}`,
          Expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        },
      },
    };
  }
  
  getCloudWatchLogsRole(config) {
    if (!config.logConfig || config.logConfig.loggingRoleArn) {
      return {};
    }
  
    return {
      [this.getLogicalId(config, RESOURCE_API_CLOUDWATCH_LOGS_ROLE)]: {
        Type: 'AWS::IAM::Role',
        Properties: {
          "AssumeRolePolicyDocument": {
            "Version" : "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Principal": {
                  "Service": [ "appsync.amazonaws.com" ]
                },
                "Action": [ "sts:AssumeRole" ]
              }
            ]
          },
          Policies: [
            {
              PolicyName: "GraphQlApiCloudWatchLogsPolicy",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                  {
                    "Effect": "Allow",
                    "Action": [
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:PutLogEvents"
                    ],
                    "Resource": [
                      {
                        "Fn::Sub" : [
                          "arn:aws:logs:${region}:${accountId}:*",
                          {
                            region: config.region,
                            accountId: { "Ref" : "AWS::AccountId" },
                          }
                        ]
                      }
                    ]
                  }
                ],
              }
            },
          ]
        }
      }
    };
  }
  
  getDataSourceIamRolesResouces(config) {
    
    return config.dataSources.reduce((acc, ds) => {
      
      // Only generate DataSource Roles for compatible types
      // and if `serviceRoleArn` not provided
      if (
        ['AWS_LAMBDA', 'AMAZON_DYNAMODB', 'AMAZON_ELASTICSEARCH'].indexOf(ds.type) === -1
        || (ds.config && ds.config.serviceRoleArn)
      ) {
        return acc;
      }
      
      let statements;
      
      if (ds.config && ds.config.iamRoleStatements) {
        statements = ds.config.iamRoleStatements;
      } else {
        // Try to generate default statements for the given DataSource.
        statements = this.getDefaultDataSourcePolicyStatements(ds, config);
        
        // If we could not generate it, skip this step.
        if (false === statements) {
          return acc;
        }
      }
      
      const resource = {
        Type: 'AWS::IAM::Role',
        Properties: {
          "AssumeRolePolicyDocument": {
            "Version" : "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Principal": {
                  "Service": [ "appsync.amazonaws.com" ]
                },
                "Action": [ "sts:AssumeRole" ]
              }
            ]
          },
          Policies: [
            {
              // TODO: Why are inline policies getting fine-grained policy names? There is no benefit to this.
              PolicyName: this.getDataSourceCfnName(ds.name) + "Policy",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: statements,
              }
            },
          ]
        }
      };
      // NOTE: No two AppSync APIs should share datasources. For potential fine-grain access implementation.
      return Object.assign({}, acc, { [this.getLogicalId(config, this.getLogicalId(ds, RESOURCE_DATASOURCE_ROLE))]: resource });
    }, {});
  }
  
  getDefaultDataSourcePolicyStatements(ds, config) {
    
    const defaultStatement = {
      Effect: "Allow",
      Action: [],
      Resource: []
    };
  
    switch (ds.type) {
      case 'AWS_LAMBDA':
        // Allow "invoke" for the Datasource's function and its aliases/versions
        defaultStatement.Action = ["lambda:invokeFunction"];
        defaultStatement.Resource = [
          ds.config.lambdaFunctionArn,
          { "Fn::Join" : [ ":", [ ds.config.lambdaFunctionArn, '*' ] ] }
        ];
        break;
        
      case 'AMAZON_DYNAMODB':
        // Allow any action on the Datasource's table
        defaultStatement.Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ];
        
        const resourceArn = {
          "Fn::Join" : [
            ":",
            [
              'arn',
              'aws',
              'dynamodb',
              ds.config.region || config.region,
              { "Ref" : "AWS::AccountId" },
              { "Fn::Join" : [ "/", ['table',  ds.config.tableName] ] },
            ]
          ]
        };
        
        defaultStatement.Resource = [
          resourceArn,
          { "Fn::Join" : [ "/", [resourceArn, '*'] ] },
        ];
        break;
        
      case 'AMAZON_ELASTICSEARCH':
        // Allow any action on the Datasource's ES endpoint
        defaultStatement.Action = [
          "es:ESHttpDelete",
          "es:ESHttpGet",
          "es:ESHttpHead",
          "es:ESHttpPost",
          "es:ESHttpPut",
        ];
        
        const rx = /^https:\/\/([a-z0-9\-]+\.\w{2}\-[a-z]+\-\d\.es\.amazonaws\.com)$/;
        const result = rx.exec(ds.config.endpoint);
        
        if (!result) {
          throw new this.serverless.classes.Error(`Invalid AWS ElasticSearch endpoint: '${ds.config.endpoint}`);
        }
        
        defaultStatement.Resource = [
          {
            "Fn::Join" : [ ":", [
              'arn',
              'aws',
              'es',
              ds.config.region || config.region,
              { "Ref" : "AWS::AccountId" },
              `domain/${result[1]}`
            ]]
          },
        ];
        break;
        
      default:
        // unknown or non compatible type
        return false;
    }
    
    return [defaultStatement];
  }

  getDataSourceResources(config) {
    return config.dataSources.reduce((acc, ds) => {
      const resource = {
        Type: 'AWS::AppSync::DataSource',
        Properties: {
          ApiId: { 'Fn::GetAtt': [this.getLogicalId(config, RESOURCE_API), 'ApiId'] },
          Name: ds.name,
          Description: ds.description,
          Type: ds.type,
        },
      };

      // If a serviceRoleArn was given for this DataSource, use it
      if (ds.config && ds.config.serviceRoleArn) {
        resource.Properties.ServiceRoleArn = ds.config.serviceRoleArn;
      } else {
        const dataSourceRoleLogicalId = this.getLogicalId(config, this.getLogicalId(ds, RESOURCE_DATASOURCE_ROLE));
        // If a Role Resource was generated for this DataSource, use it
        const role = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[dataSourceRoleLogicalId];
        if (role) {
          resource.Properties.ServiceRoleArn = { 'Fn::GetAtt': [dataSourceRoleLogicalId, 'Arn'] }
        }
      }
      
      if (ds.type === 'AWS_LAMBDA') {
        resource.Properties.LambdaConfig = {
          LambdaFunctionArn: ds.config.lambdaFunctionArn,
        };
      } else if (ds.type === 'AMAZON_DYNAMODB') {
        resource.Properties.DynamoDBConfig = {
          AwsRegion: ds.config.region || config.region,
          TableName: ds.config.tableName,
          UseCallerCredentials: !!ds.config.useCallerCredentials,
        };
      } else if (ds.type === 'AMAZON_ELASTICSEARCH') {
        resource.Properties.ElasticsearchConfig = {
          AwsRegion: ds.config.region || config.region,
          Endpoint: ds.config.endpoint,
        };
      } else if (ds.type === 'HTTP') {
        resource.Properties.HttpConfig = {
          Endpoint: ds.config.endpoint,
        };
      } else if (ds.type !== 'NONE') {
        throw new this.serverless.classes.Error(`Data Source Type not supported: '${ds.type}`);
      }
      // NOTE: No two AppSync APIs should share datasources. For potential fine-grain access implementation.
      return Object.assign({}, acc, { [this.getLogicalId(config, this.getLogicalId(ds, RESOURCE_DATASOURCE))]: resource });
    }, {});
  }

  getGraphQLSchemaResource(config) {
    return {
      [this.getLogicalId(config, RESOURCE_SCHEMA)]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: config.schema,
          ApiId: { 'Fn::GetAtt': [this.getLogicalId(config, RESOURCE_API), 'ApiId'] },
        },
      },
    };
  }

  getResolverResources(config) {
    return config.mappingTemplates.reduce((acc, tpl) => {
      const reqTemplPath = path.join(config.mappingTemplatesLocation, tpl.request);
      const respTemplPath = path.join(config.mappingTemplatesLocation, tpl.response);
      const requestTemplate = fs.readFileSync(reqTemplPath, 'utf8');
      const responseTemplate = fs.readFileSync(respTemplPath, 'utf8');

      return Object.assign({}, acc, {
        [`${this.getLogicalId(config, `${RESOURCE_RESOLVER}${tpl.type}${tpl.field}`)}`]: {
          Type: 'AWS::AppSync::Resolver',
          DependsOn: this.getLogicalId(config, RESOURCE_SCHEMA),
          Properties: {
            ApiId: { 'Fn::GetAtt': [this.getLogicalId(config, RESOURCE_API), 'ApiId'] },
            TypeName: tpl.type,
            FieldName: tpl.field,
            DataSourceName: { 'Fn::GetAtt': [this.getLogicalId({name: tpl.dataSource}, RESOURCE_DATASOURCE), 'Name'] },
            RequestMappingTemplate: this.processTemplate(requestTemplate, config),
            ResponseMappingTemplate: this.processTemplate(responseTemplate, config),
          },
        },
      });
    }, {});
  }

  getLogicalId(config, resourceType) {
    // Similar to serverless' implementation of functions
    // (e.g. getUser becomes GetUserLambdaFunction for CloudFormation logical ID,
    //  myService becomes MyServiceGraphQLApi or `MyService${resourceType}`)
    if (config.isSingleConfig) {
      // This will ensure people with CloudFormation stack dependencies on the previous
      // version of the plugin doesn't break their {@code deleteGraphQLEndpoint} functionality
        return this.getCfnName(resourceType);
    } else {
      return this.getCfnName(config.name[0].toUpperCase() + config.name.slice(1) + resourceType);
    }
  }

  getGraphQlApiOutputs(config) {
    return {
      [this.getLogicalId(config, RESOURCE_URL)]: {
        Value: { 'Fn::GetAtt': [this.getLogicalId(config, RESOURCE_API), 'GraphQLUrl'] },
      },
    };
  }

  getApiKeyOutputs(config) {
    if (config.authenticationType !== 'API_KEY') {
      return {};
    }
    return {
      [this.getLogicalId(config, RESOURCE_API_KEY)]: {
        Value: { 'Fn::GetAtt': [this.getLogicalId(config, RESOURCE_API_KEY), 'ApiKey'] },
      },
    };
  }

  getCfnName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  getDataSourceCfnName(name) {
    return `GraphQlDs${this.getCfnName(name)}`;
  }

  processTemplate(template, config) {
    // TODO use serverless variable parser and serverless variable syntax config
    const variableSyntax = RegExp(/\${([\w\d-_]+)}/g);
    const configVariables = Object.keys(config.substitutions);
    const templateVariables = [];
    let searchResult;
    // eslint-disable-next-line no-cond-assign
    while ((searchResult = variableSyntax.exec(template)) !== null) {
      templateVariables.push(searchResult[1]);
    }

    const substitutions = configVariables
      .filter(value => templateVariables.indexOf(value) > -1)
      .filter((value, index, array) => array.indexOf(value) === index)
      .reduce(
        (accum, value) => Object.assign(accum, { [value]: config.substitutions[value] }),
        {},
      );

    // if there are substitutions for this template then add fn:sub
    if (Object.keys(substitutions).length > 0) {
      return { 'Fn::Sub': [template, substitutions] };
    }

    return template;
  }
}

module.exports = ServerlessAppsyncPlugin;

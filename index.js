const fs = require('fs');
const path = require('path');
const {
  validateSchema, printError, parse, buildASTSchema,
} = require('graphql');
const getConfig = require('./get-config');

const MIGRATION_DOCS = 'https://github.com/sid88in/serverless-appsync-plugin/blob/master/README.md#cfn-migration';

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
      'before:deploy:initialize': () => this.validateSchema(),
      'delete-appsync:delete': () => this.deleteGraphQLEndpoint(),
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

  getSchema() {
    const { schema } = this.loadConfig();

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

    return `${schema} ${awsTypes}`;
  }

  validateSchema() {
    const schema = this.getSchema();
    const ast = buildASTSchema(parse(schema));
    const errors = validateSchema(ast);
    if (!errors.length) {
      return;
    }

    errors.forEach((error) => {
      this.serverless.cli.log(printError(error));
    });
    throw new this.serverless.classes.Error('Cannot proceed invalid graphql SDL');
  }

  deleteGraphQLEndpoint() {
    const config = this.loadConfig();
    const { apiId } = config;
    if (!apiId) {
      throw new this.serverless.classes.Error('serverless-appsync: no apiId is defined. If you are not '
        + `migrating from a previous version of the plugin this is expected.  See ${MIGRATION_DOCS} '
        + 'for more information`);
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
  }

  addResources() {
    const config = this.loadConfig();

    if (config.apiId) {
      this.serverless.cli.log('WARNING: serverless-appsync has been updated in a breaking way and your '
        + 'service is configured using a reference to an existing apiKey in '
        + '`custom.appSync` which is used in the legacy deploy scripts. This deploy will create '
        + `new graphql resources and WILL NOT update your existing api. See ${MIGRATION_DOCS} for `
        + 'more information');
    }

    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    Object.assign(resources, this.getGraphQlApiEndpointResource(config));
    Object.assign(resources, this.getApiKeyResources(config));
    Object.assign(resources, this.getGraphQLSchemaResource(config));
    Object.assign(resources, this.getCloudWatchLogsRole(config));
    Object.assign(resources, this.getDataSourceIamRolesResouces(config));
    Object.assign(resources, this.getDataSourceResources(config));
    Object.assign(resources, this.getResolverResources(config));

    const outputs = this.serverless.service.provider.compiledCloudFormationTemplate.Outputs;
    Object.assign(outputs, this.getGraphQlApiOutputs(config));
    Object.assign(outputs, this.getApiKeyOutputs(config));
  }

  getGraphQlApiEndpointResource(config) {
    return {
      GraphQlApi: {
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
            CloudWatchLogsRoleArn: config.logConfig.loggingRoleArn || { "Fn::GetAtt": ["GraphQlApiCloudWatchLogsRole", "Arn"] },
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
      GraphQlApiKeyDefault: {
        Type: 'AWS::AppSync::ApiKey',
        Properties: {
          ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
          Description: 'serverless-appsync-plugin: Default',
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
      "GraphQlApiCloudWatchLogsRole": {
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
              PolicyName: this.getDataSourceCfnName(ds.name) + "Policy",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: statements,
              }
            },
          ]
        }
      };
      
      return Object.assign({}, acc, { [this.getDataSourceCfnName(ds.name) + "Role"]: resource });
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
          ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
          Name: ds.name,
          Description: ds.description,
          Type: ds.type,
        },
      };

      // If a serviceRoleArn was given for this DataAsouce, use it
      if (ds.config && ds.config.serviceRoleArn) {
        resource.Properties.ServiceRoleArn = ds.config.serviceRoleArn;
      } else {
        const roleResouceName = this.getDataSourceCfnName(ds.name) + "Role";
        // If a Role Resource was generated for this DataSource, use it
        const role = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[roleResouceName];
        if (role) {
          resource.Properties.ServiceRoleArn = { 'Fn::GetAtt': [roleResouceName, 'Arn'] }
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
      return Object.assign({}, acc, { [this.getDataSourceCfnName(ds.name)]: resource });
    }, {});
  }

  getGraphQLSchemaResource(config) {
    return {
      GraphQlSchema: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: config.schema,
          ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
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
        [`GraphQlResolver${this.getCfnName(tpl.type)}${this.getCfnName(tpl.field)}`]: {
          Type: 'AWS::AppSync::Resolver',
          DependsOn: 'GraphQlSchema',
          Properties: {
            ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
            TypeName: tpl.type,
            FieldName: tpl.field,
            DataSourceName: { 'Fn::GetAtt': [this.getDataSourceCfnName(tpl.dataSource), 'Name'] },
            RequestMappingTemplate: this.processTemplate(requestTemplate, config),
            ResponseMappingTemplate: this.processTemplate(responseTemplate, config),
          },
        },
      });
    }, {});
  }

  getGraphQlApiOutputs() {
    return {
      GraphQlApiUrl: {
        Value: { 'Fn::GetAtt': ['GraphQlApi', 'GraphQLUrl'] },
      },
    };
  }

  getApiKeyOutputs(config) {
    if (config.authenticationType !== 'API_KEY') {
      return {};
    }
    return {
      GraphQlApiKeyDefault: {
        Value: { 'Fn::GetAtt': ['GraphQlApiKeyDefault', 'ApiKey'] },
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

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
      'after:aws:package:finalize:mergeCustomProviderResources': () => this.addResources(),
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
          },
          OpenIDConnectConfig: config.authenticationType !== 'OPENID_CONNECT' ? undefined : {
            Issuer: config.openIdConnectConfig.issuer,
            ClientId: config.openIdConnectConfig.clientId,
            IatTTL: config.openIdConnectConfig.iatTTL,
            AuthTTL: config.openIdConnectConfig.authTTL,
          },
          LogConfig: !config.logConfig ? undefined : {
            CloudWatchLogsRoleArn: config.logConfig.loggingRoleArn,
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

  getDataSourceResources(config) {
    return config.dataSources.reduce((acc, ds) => {
      const resource = {
        Type: 'AWS::AppSync::DataSource',
        Properties: {
          ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
          Name: ds.name,
          Description: ds.description,
          Type: ds.type,
          ServiceRoleArn: ds.type === 'NONE' ? undefined : ds.config.serviceRoleArn,
        },
      };
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

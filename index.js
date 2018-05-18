const fs = require('fs');
const path = require('path');
const getConfig = require('./get-config');

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.commands = {
      'delete-appsync': {
        usage: 'DEPRECATED: Helps you delete AppSync API',
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
      throw new this.serverless.classes.Error(`${command} is no longer supported. TODO add migration instructions`);
    };
    this.hooks = {
      'delete-appsync:delete': () => generateMigrationErrorMessage('delete-appsync'),
      'deploy-appsync:deploy': () => generateMigrationErrorMessage('deploy-appsync'),
      'update-appsync:update': () => generateMigrationErrorMessage('update-appsync'),
      'before:deploy:deploy': () => this.addResources(),
    };
  }

  async addResources() {
    const config = getConfig(
      this.serverless.service.custom.appSync,
      this.serverless.service.provider,
      this.serverless.config.servicePath,
    );

    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    Object.assign(resources, this.getGraphQlApiEndpointResource(config));
    Object.assign(resources, this.getApiKeyResources(config));
    Object.assign(resources, this.getGraphQLSchemaResource(config));
    Object.assign(resources, this.getDataSourceResources(config));
    Object.assign(resources, this.getResolverResources(config));
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
          ServiceRoleArn: ds.config.serviceRoleArn,
        },
      };
      if (ds.type === 'AWS_LAMBDA') {
        resource.Properties.LambdaConfig = {
          LambdaFunctionArn: ds.config.lambdaFunctionArn,
        };
      } else if (ds.type === 'AMAZON_DYNAMODB') {
        resource.Properties.DynamoDBConfig = {
          AwsRegion: config.region,
          TableName: ds.config.tableName,
          UseCallerCredentials: !!ds.config.useCallerCredentials,
        };
      } else if (ds.type === 'AMAZON_ELASTICSEARCH') {
        resource.Properties.ElasticsearchConfig = {
          AwsRegion: config.region,
          Endpoint: ds.config.endpoint,
        };
      } else if (ds.type !== 'NONE') {
        throw new this.serverless.classes.Error(`Data Source Type not supported: '${ds.type}`);
      }
      return Object.assign({}, acc, { [`GraphQlDs${ds.name}`]: resource });
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
      return Object.assign({}, acc, {
        [`GraphQlResolver${tpl.field}`]: {
          Type: 'AWS::AppSync::Resolver',
          DependsOn: 'GraphQlSchema',
          Properties: {
            ApiId: { 'Fn::GetAtt': ['GraphQlApi', 'ApiId'] },
            TypeName: tpl.type,
            FieldName: tpl.field,
            DataSourceName: tpl.dataSource,
            RequestMappingTemplate: fs.readFileSync(reqTemplPath, 'utf8'),
            ResponseMappingTemplate: fs.readFileSync(respTemplPath, 'utf8'),
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
}

module.exports = ServerlessAppsyncPlugin;

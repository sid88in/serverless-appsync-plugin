const fs = require('fs');
const BbPromise = require('bluebird');
const async = require('async');
const getConfig = require('./get-config');

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.commands = {
      'deploy-appsync': {
        lifecycleEvents: ['deploy'],
      },
    };
    this.hooks = {
      'deploy-appsync:deploy': () => BbPromise.bind(this)
        .then(this.loadConfig)
        .then(this.createGraphQLEndpoint)
        .then(this.attachDataSources)
        .then(this.createGraphQLSchema)
        .then(this.monitorGraphQLSchemaCreation)
        .then(this.getSchemaForGraphQLEndpoint)
        .then(this.createResolvers)
        .then(this.listTypes),
    };
  }

  loadConfig() {
    const config = getConfig(
      this.serverless.service.custom.appSync,
      this.serverless.service.provider,
      this.serverless.config.servicePath
    );
    // NOTE storing the config in the appSync object
    this.serverless.service.custom.appSync.resolvedConfig = config;
  }

  createGraphQLEndpoint() {
    this.serverless.cli.log('Creating GraphQL Endpoint...');
    const resolvedConfig = this.serverless.service.custom.appSync.resolvedConfig;
    return this.provider.request('AppSync', 'createGraphqlApi', {
      authenticationType: resolvedConfig.authenticationType,
      name: resolvedConfig.name,
      userPoolConfig: {
        awsRegion: resolvedConfig.region,
        defaultAction: resolvedConfig.userPoolConfig.defaultAction,
        userPoolId: resolvedConfig.userPoolConfig.userPoolId,
      },
    }).then((data) => {
      this.serverless.cli.log(`GraphQL API ID: ${data.graphqlApi.apiId}`);
      this.serverless.cli.log(`GraphQL Endpoint: ${data.graphqlApi.uris.GRAPHQL}`);
      // NOTE: storign the config in the appSync object
      this.serverless.service.custom.appSync.awsResult = data;
    });
  }

  attachDataSources() {
    this.serverless.cli.log('Attaching data sources...');
    const resolvedConfig = this.serverless.service.custom.appSync.resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    // TODO: make this more configurable?!
    // eslint-disable-next-line arrow-body-style
    const datasourceParams = resolvedConfig.dataSources.map((ds) => {
      let config;
      switch (ds.type) {
        case 'AWS_LAMBDA':
          config = {
            lambdaConfig: {
              lambdaFunctionArn: ds.config.lambdaFunctionArn,
            },
          };
          break;
        case 'AMAZON_DYNAMODB':
          config = {
            dynamodbConfig: {
              awsRegion: resolvedConfig.region,
              tableName: ds.config.tableName,
            },
          };
          if (ds.config.useCallerCredentials) {
            Object.assign(config, { useCallerCredentials: ds.config.useCallerCredentials });
          }
          break;
        case 'AMAZON_ELASTICSEARCH':
          config = {
            elasticsearchConfig: {
              awsRegion: resolvedConfig.region,
              endpoint: ds.config.endpoint,
            },
          };
          break;
        default:
          this.serverless.cli.log('Data Source Type not supported', ds.type);
      }
      const dataSource = {
        apiId: awsResult.graphqlApi.apiId,
        name: ds.name,
        type: ds.type,
        description: ds.description,
        serviceRoleArn: ds.config.serviceRoleArn,
      };
      Object.assign(dataSource, config);
      return dataSource;
    });

    return BbPromise.map(datasourceParams, params =>
      this.provider.request('AppSync', 'createDataSource', params));
  }

  createGraphQLSchema() {
    this.serverless.cli.log('Creating GraphQL Schema');
    const resolvedConfig = this.serverless.service.custom.appSync.resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;
    const schema = Buffer.from(resolvedConfig.schema);
    return this.provider.request('AppSync', 'startSchemaCreation', {
      apiId: awsResult.graphqlApi.apiId,
      definition: schema,
    });
  }

  monitorGraphQLSchemaCreation() {
    const awsResult = this.serverless.service.custom.appSync.awsResult;
    let isReady = false;

    return new BbPromise((resolve, reject) => {
      async.until(
        () => isReady,
        // eslint-disable-next-line arrow-body-style
        (callback) => {
          return this.provider.request('AppSync', 'getSchemaCreationStatus', {
            apiId: awsResult.graphqlApi.apiId,
          }).then((result) => {
            this.serverless.cli.log(result.status);
            if (result.status === 'SUCCESS') {
              this.serverless.cli.log('schema for GraphQL endpoint created...');
              isReady = true;
            }
            if (result.status === 'FAILED') {
              this.serverless.cli.log('Creating schema for GraphQL endpoint failed...');
              reject(result.details);
            }
            callback();
          }).catch((error) => {
            reject(error);
          });
        },
        () => resolve(),
      );
    });
  }

  getSchemaForGraphQLEndpoint() {
    this.serverless.cli.log('Getting schema for GraphQL endpoint...');
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    return this.provider.request('AppSync', 'getIntrospectionSchema', {
      apiId: awsResult.graphqlApi.apiId,
      format: 'SDL',
    });
  }

  createResolvers() {
    this.serverless.cli.log('Creating resolvers...');
    const resolvedConfig = this.serverless.service.custom.appSync.resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;
    // TODO: make this more configurable?!
    // TODO: make calls async
    // eslint-disable-next-line arrow-body-style
    const resolverParams = resolvedConfig.mappingTemplates.map((tpl) => {
      return {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: tpl.dataSource,
        fieldName: tpl.field,
        requestMappingTemplate: fs.readFileSync(
          `${resolvedConfig.mappingTemplatesLocation}/${tpl.request}`,
          'utf8',
        ),
        typeName: tpl.type,
        responseMappingTemplate: fs.readFileSync(
          `${resolvedConfig.mappingTemplatesLocation}/${tpl.response}`,
          'utf8',
        ),
      };
    });

    return BbPromise.map(resolverParams, params =>
      this.provider.request('AppSync', 'createResolver', params));
  }

  listTypes() {
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    return this.provider.request('AppSync', 'listTypes', {
      apiId: awsResult.graphqlApi.apiId,
      format: 'SDL',
    }).then((result) => {
      this.serverless.cli.log(result);
    });
  }
}

module.exports = ServerlessAppsyncPlugin;

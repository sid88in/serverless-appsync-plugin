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
        defaultAction: resolvedConfig.defaultAction,
        userPoolId: resolvedConfig.userPoolId,
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

    // TODO: make this configurable?!
    const datasourceParams = [
      {
        apiId: awsResult.graphqlApi.apiId,
        name: 'Users',
        type: 'AMAZON_DYNAMODB',
        description: 'Store user info',
        dynamodbConfig: {
          awsRegion: resolvedConfig.region,
          tableName: 'Users',
        },
        serviceRoleArn: resolvedConfig.serviceRoleArn,
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        name: 'Tweets',
        type: 'AMAZON_DYNAMODB',
        description: 'Store user info',
        dynamodbConfig: {
          awsRegion: resolvedConfig.region,
          tableName: 'Tweets',
        },
        serviceRoleArn: resolvedConfig.serviceRoleArn,
      },
    ];

    return BbPromise.map(datasourceParams, params =>
      this.provider.request('AppSync', 'createDataSource', params));
  }

  createGraphQLSchema() {
    this.serverless.cli.log('Creating GraphQL Schema');
    const resolvedConfig = this.serverless.service.custom.appSync.resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    return this.provider.request('AppSync', 'startSchemaCreation', {
      apiId: awsResult.graphqlApi.apiId,
      schema: resolvedConfig.schema,
    });
  }

  monitorGraphQLSchemaCreation() {
    const awsResult = this.serverless.service.custom.appSync.awsResult;
    let isReady = false;

    return new BbPromise((resolve, reject) => {
      async.whilst(
        () => isReady,
        (callback) => {
          // eslint-disable-next-line arrow-body-style
          setTimeout(() => {
            return this.provider.request('AppSync', 'getSchemaCreationStatus', {
              apiId: awsResult.graphqlApi.apiId,
            }).then((result) => {
              if (result.status === 'SUCCESS') {
                isReady = true;
              }
              return callback();
            }).catch((error) => {
              reject(error);
            });
          }, 5000);
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
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    // TODO: make this configurable?!
    // TODO: make calls async
    const resolverParams = [
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Users',
        fieldName: 'getUserInfo',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/getUserInfo-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Query',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/getUserInfo-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Users',
        fieldName: 'meInfo',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/meInfo-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Query',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/meInfo-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Tweets',
        fieldName: 'topTweet',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/topTweet-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'User',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/topTweet-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Tweets',
        fieldName: 'tweets',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/tweets-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'User',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/tweets-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Tweets',
        fieldName: 'createTweet',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/createTweet-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Mutation',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/createTweet-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Tweets',
        fieldName: 'deleteTweet',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/deleteTweet-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Mutation',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/deleteTweet-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Tweets',
        fieldName: 'reTweet',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/reTweet-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Mutation',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/reTweet-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Tweets',
        fieldName: 'updateTweet',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/updateTweet-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Mutation',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/updateTweet-response-mapping-template.txt',
          'utf8',
        ),
      },
      {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: 'Users',
        fieldName: 'updateUserInfo',
        requestMappingTemplate: fs.readFileSync(
          'mapping-templates/updateUserInfo-request-mapping-template.txt',
          'utf8',
        ),
        typeName: 'Mutation',
        responseMappingTemplate: fs.readFileSync(
          'mapping-templates/updateUserInfo-response-mapping-template.txt',
          'utf8',
        ),
      },
    ];

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

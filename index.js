const fs = require("fs");
const BbPromise = require("bluebird");
const async = require("async");
const getConfig = require("./get-config");

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider("aws");
    this.commands = {
      "delete-appsync": {
        usage: 'Helps you delete AppSync API',
        lifecycleEvents: ["delete"]
      },
      "deploy-appsync": {
        usage: 'Helps you deploy AppSync API',
        lifecycleEvents: ["deploy"]
      },
      "update-appsync": {
        usage: 'Helps you update AppSync API',
        lifecycleEvents: ["update"]
      }
    };
    this.hooks = {
      "delete-appsync:delete": () =>
        BbPromise.bind(this)
          .then(this.loadConfig)
          .then(this.deleteGraphQLEndpoint),
      "deploy-appsync:deploy": () =>
        BbPromise.bind(this)
          .then(this.loadConfig)
          .then(this.createGraphQLEndpoint)
          .then(this.attachDataSources)
          .then(this.createGraphQLSchema)
          .then(this.monitorGraphQLSchemaCreation)
          .then(this.getSchemaForGraphQLEndpoint)
          .then(this.createResolvers)
          .then(this.listTypes),
      "update-appsync:update": () =>
        BbPromise.bind(this)
          .then(this.loadConfig)
          .then(this.updateGraphQLEndpoint)
          .then(this.cleanupDataSources)
          .then(this.updateDataSources)
          .then(this.createGraphQLSchema)
          .then(this.monitorGraphQLSchemaCreation)
          .then(this.getSchemaForGraphQLEndpoint)
          .then(this.updateResolvers)
          .then(this.listTypes)
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

  deleteGraphQLEndpoint() {
    this.serverless.cli.log("Deleting GraphQL Endpoint...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;

    const { apiId } = resolvedConfig;
    return this.provider
      .request("AppSync", "deleteGraphqlApi", {
        apiId
      })
      .then(data => {
        if (data) {
          this.serverless.cli.log(
            `Successfully deleted GraphQL Endpoint: ${apiId}`
          );
        }
      });
  }

  createAPIKey(){
      this.serverless.cli.log("Creating API Key...");
      const resolvedConfig = this.serverless.service.custom.appSync
          .resolvedConfig;
      const awsResult = this.serverless.service.custom.appSync.awsResult;

      return this.provider
          .request("AppSync", "createApiKey", {
              apiId: awsResult.graphqlApi.apiId,
          })
          .then(data => {
              this.serverless.cli.log(`GraphQL API Key: ${data.apiKey.id}`);
          });
  }

  createGraphQLEndpoint() {
    this.serverless.cli.log("Creating GraphQL Endpoint...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;

       let config = {
            authenticationType: resolvedConfig.authenticationType,
            name: resolvedConfig.name,
       };

       if(resolvedConfig.authenticationType === 'AMAZON_COGNITO_USER_POOLS'){
            config.userPoolConfig = {
                awsRegion: resolvedConfig.region,
                defaultAction: resolvedConfig.userPoolConfig.defaultAction,
                userPoolId: resolvedConfig.userPoolConfig.userPoolId
           }
       }

    return this.provider
      .request("AppSync", "createGraphqlApi", config)
      .then(data => {
        this.serverless.cli.log(`GraphQL API ID: ${data.graphqlApi.apiId}`);
        this.serverless.cli.log(
          `GraphQL Endpoint: ${data.graphqlApi.uris.GRAPHQL}`
        );
        // NOTE: storing the config in the appSync object
        this.serverless.service.custom.appSync.awsResult = data;

        if (resolvedConfig.authenticationType === 'API_KEY') {
            this.createAPIKey();
        }
      });
  }

  updateGraphQLEndpoint() {
    this.serverless.cli.log("Updating GraphQL Endpoint...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;

    return this.provider
      .request("AppSync", "updateGraphqlApi", {
        apiId: resolvedConfig.apiId,
        authenticationType: resolvedConfig.authenticationType,
        name: resolvedConfig.name,
        userPoolConfig: {
          awsRegion: resolvedConfig.region,
          defaultAction: resolvedConfig.userPoolConfig.defaultAction,
          userPoolId: resolvedConfig.userPoolConfig.userPoolId
        }
      })
      .then(data => {
        this.serverless.cli.log(`GraphQL API ID: ${data.graphqlApi.apiId}`);
        this.serverless.cli.log(
          `GraphQL Endpoint: ${data.graphqlApi.uris.GRAPHQL}`
        );
        // NOTE: storing the config in the appSync object
        this.serverless.service.custom.appSync.awsResult = data;
      });
  }

  attachDataSources() {
    this.serverless.cli.log("Attaching data sources...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    // eslint-disable-next-line arrow-body-style
    const datasourceParams = resolvedConfig.dataSources.map(ds => {
      let config;
      switch (ds.type) {
        case "AWS_LAMBDA":
          config = {
            lambdaConfig: {
              lambdaFunctionArn: ds.config.lambdaFunctionArn
            }
          };
          break;
        case "AMAZON_DYNAMODB":
          config = {
            dynamodbConfig: {
              awsRegion: resolvedConfig.region,
              tableName: ds.config.tableName
            }
          };
          if (ds.config.useCallerCredentials) {
            Object.assign(config, {
              useCallerCredentials: ds.config.useCallerCredentials
            });
          }
          break;
        case "AMAZON_ELASTICSEARCH":
          config = {
            elasticsearchConfig: {
              awsRegion: resolvedConfig.region,
              endpoint: ds.config.endpoint
            }
          };
          break;
        case "NONE":
          config = {};
          break;
        default:
          this.serverless.cli.log("Data Source Type not supported", ds.type);
      }
      const dataSource = {
        apiId: awsResult.graphqlApi.apiId,
        name: ds.name,
        type: ds.type,
        description: ds.description,
        serviceRoleArn: ds.config.serviceRoleArn
      };
      Object.assign(dataSource, config);
      return dataSource;
    });

    return BbPromise.map(datasourceParams, params =>
      this.provider.request("AppSync", "createDataSource", params).then(() => {
        this.serverless.cli.log(`Created new data source: ${params.name}`);
      })
    );
  }

  updateDataSources() {
    this.serverless.cli.log("Updating data sources...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    // eslint-disable-next-line arrow-body-style
    const datasourceParams = resolvedConfig.dataSources.map(ds => {
      let config;
      switch (ds.type) {
        case "AWS_LAMBDA":
          config = {
            lambdaConfig: {
              lambdaFunctionArn: ds.config.lambdaFunctionArn
            }
          };
          break;
        case "AMAZON_DYNAMODB":
          config = {
            dynamodbConfig: {
              awsRegion: resolvedConfig.region,
              tableName: ds.config.tableName
            }
          };
          if (ds.config.useCallerCredentials) {
            Object.assign(config, {
              useCallerCredentials: ds.config.useCallerCredentials
            });
          }
          break;
        case "AMAZON_ELASTICSEARCH":
          config = {
            elasticsearchConfig: {
              awsRegion: resolvedConfig.region,
              endpoint: ds.config.endpoint
            }
          };
          break;
        case "NONE":
          config = {};
          break;
        default:
          this.serverless.cli.log("Data Source Type not supported", ds.type);
      }
      const dataSource = {
        apiId: awsResult.graphqlApi.apiId,
        name: ds.name,
        type: ds.type,
        description: ds.description,
        serviceRoleArn: ds.config.serviceRoleArn
      };
      Object.assign(dataSource, config);

      return dataSource;
    });

    return BbPromise.map(datasourceParams, resolver => {
      return this.provider
        .request("AppSync", "updateDataSource", resolver)
        .then(() => {
          this.serverless.cli.log(`Updated data source: ${resolver.name}`);
        })
        .catch(error => {
          switch (error.statusCode) {
            case 404:
              return new BbPromise((resolve, reject) => {
                this.provider
                  .request("AppSync", "createDataSource", resolver)
                  .then(() => {
                    this.serverless.cli.log(
                      `Created new data source: ${resolver.name}`
                    );
                    resolve();
                  })
                  .catch(error => {
                    reject(error);
                  });
              });
              break;
            default:
              this.serverless.cli.log(e);
          }
        });
    });
  }

  cleanupDataSources() {
    const awsResult = this.serverless.service.custom.appSync.awsResult;
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;

    // Grab the data sources from the config
    const newDataSources = resolvedConfig.dataSources.map(ds => ds.name);

    // Get the old data sources from the API
    return this.provider
      .request("AppSync", "listDataSources", {
        apiId: awsResult.graphqlApi.apiId
      })
      .then(result => {
        const dataSources = result.dataSources.map(ds => ds.name);
        const removedDataSources = dataSources.filter(
          ds => !newDataSources.includes(ds)
        );

        // Remove all the data sources that aren't defined anymore
        return BbPromise.map(removedDataSources, dataSource => {
          return this.provider
            .request("AppSync", "deleteDataSource", {
              apiId: awsResult.graphqlApi.apiId,
              name: dataSource
            })
            .then(() => {
              this.serverless.cli.log(`Deleted data source: ${dataSource}`);
            });
        });
      });
  }

  createGraphQLSchema() {
    this.serverless.cli.log("Creating GraphQL Schema");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;

    const awsResult = this.serverless.service.custom.appSync.awsResult;
    const schema = Buffer.from(resolvedConfig.schema);
    return this.provider.request("AppSync", "startSchemaCreation", {
      apiId: awsResult.graphqlApi.apiId,
      definition: schema
    });
  }

  monitorGraphQLSchemaCreation() {
    const awsResult = this.serverless.service.custom.appSync.awsResult;
    let isReady = false;

    return new BbPromise((resolve, reject) => {
      async.until(
        () => isReady,
        // eslint-disable-next-line arrow-body-style
        callback => {
          return this.provider
            .request("AppSync", "getSchemaCreationStatus", {
              apiId: awsResult.graphqlApi.apiId
            })
            .then(result => {
              this.serverless.cli.log(`${result.status} | ${result.details}`);
              if (result.status === "SUCCESS") {
                this.serverless.cli.log(
                  "Schema for GraphQL endpoint created..."
                );
                isReady = true;
              }
              if (result.status === "FAILED") {
                this.serverless.cli.log(
                  "Creating schema for GraphQL endpoint failed..."
                );
                reject(result.details);
              }
              callback();
            })
            .catch(error => {
              reject(error);
            });
        },
        () => resolve()
      );
    });
  }

  getSchemaForGraphQLEndpoint() {
    this.serverless.cli.log("Getting schema for GraphQL endpoint...");
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    return this.provider.request("AppSync", "getIntrospectionSchema", {
      apiId: awsResult.graphqlApi.apiId,
      format: "SDL"
    });
  }

  createResolvers() {
    this.serverless.cli.log("Creating resolvers...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    // eslint-disable-next-line arrow-body-style
    const resolverParams = resolvedConfig.mappingTemplates.map(tpl => {
      return {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: tpl.dataSource,
        fieldName: tpl.field,
        requestMappingTemplate: fs.readFileSync(
          `${resolvedConfig.mappingTemplatesLocation}/${tpl.request}`,
          "utf8"
        ),
        typeName: tpl.type,
        responseMappingTemplate: fs.readFileSync(
          `${resolvedConfig.mappingTemplatesLocation}/${tpl.response}`,
          "utf8"
        )
      };
    });

    return BbPromise.map(resolverParams, params =>
      this.provider.request("AppSync", "createResolver", params).then(() => {
        this.serverless.cli.log(
          `Created new resolver on field: ${params.fieldName}`
        );
      })
    );
  }

  updateResolvers() {
    this.serverless.cli.log("Updating resolvers...");
    const resolvedConfig = this.serverless.service.custom.appSync
      .resolvedConfig;
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    // eslint-disable-next-line arrow-body-style
    const resolverParams = resolvedConfig.mappingTemplates.map(tpl => {
      return {
        apiId: awsResult.graphqlApi.apiId,
        dataSourceName: tpl.dataSource,
        fieldName: tpl.field,
        requestMappingTemplate: fs.readFileSync(
          `${resolvedConfig.mappingTemplatesLocation}/${tpl.request}`,
          "utf8"
        ),
        typeName: tpl.type,
        responseMappingTemplate: fs.readFileSync(
          `${resolvedConfig.mappingTemplatesLocation}/${tpl.response}`,
          "utf8"
        )
      };
    });

    return BbPromise.map(resolverParams, params => {
      return this.provider
        .request("AppSync", "updateResolver", params)
        .then(() => {
          this.serverless.cli.log(
            `Updated resolver on field: ${params.fieldName}`
          );
        })
        .catch(error => {
          switch (error.statusCode) {
            case 404:
              return new BbPromise((resolve, reject) => {
                this.provider
                  .request("AppSync", "createResolver", params)
                  .then(() => {
                    this.serverless.cli.log(
                      `Created new resolver on field: ${params.fieldName}`
                    );
                    resolve();
                  })
                  .catch(error => {
                    reject(error);
                  });
              });
              break;
            default:
              this.serverless.cli.log(e);
          }
        });
    });
  }

  listTypes() {
    const awsResult = this.serverless.service.custom.appSync.awsResult;

    return this.provider
      .request("AppSync", "listTypes", {
        apiId: awsResult.graphqlApi.apiId,
        format: "SDL"
      })
      .then(result => {
        this.serverless.cli.log(
          `Type List: ${result.types.map(type => type.name)}`
        );
        this.serverless.cli.log(
          "All done deploying/updating data sources and resolvers."
        );
      });
  }
}

module.exports = ServerlessAppsyncPlugin;

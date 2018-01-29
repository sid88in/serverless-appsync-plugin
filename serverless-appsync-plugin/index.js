const getConfig = require('./get-config');

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      'deploy-appsync': {
        lifecycleEvents: ['deploy']
      }
    };
    this.hooks = {
      'deploy-appsync:deploy': this.deployAppSync.bind(this)
    };
  }

  deployAppSync() {
    this.serverless.cli.log('Deploying AppSync Config');
    const config = getConfig(
      this.serverless.service.custom.appSync,
      this.serverless.service.provider,
      this.serverless.config.servicePath
    );
    console.log(config);
    return new Promise((resolve, reject) => {
      resolve();
    });
  }
}

module.exports = ServerlessAppsyncPlugin;

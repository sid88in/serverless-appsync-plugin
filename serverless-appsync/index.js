'use strict';

class ServerlessAppsyncPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'after:deploy:deploy': this.afterDeploy.bind(this)
    };
  }

  afterDeploy() {
    this.serverless.cli.log('Deploying AppSync Config');
    // NOTE contains the parsed serverless.yml
    console.log(this.serverless.service);
    // NOTE returning a Promise is not required, but can be used
    // to make sure all steps are executed before proceeding to the
    // next step.
    return new Promise((resolve, reject) => {
      resolve();
    });
  }
}

module.exports = ServerlessAppsyncPlugin;

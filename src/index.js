import {
  AmplifyAppSyncSimulator,
  addDataLoader,
  removeDataLoader,
} from 'amplify-appsync-simulator';
import { get, merge } from 'lodash';
import getAppSyncConfig from './getAppSyncConfig';
import LambdaDataLoader from './data-loaders/LambdaDataLoader';
import NotImplementedDataLoader from './data-loaders/NotImplementedDataLoader';

class ServerlessAppSyncSimulator {
  constructor(serverless) {
    this.serverless = serverless;
    this.serverlessLog = serverless.cli.log.bind(serverless.cli);
    this.options = merge(
      {
        apiKey: '0123456789',
        port: 20002,
        wsPort: 20003,
        location: '.',
        dynamoDb: {
          endpoint: `http://localhost:${get(this.serverless.service, 'custom.dynamodb.start.port', 8000)}`,
          region: 'localhost',
          accessKeyId: 'DEFAULT_ACCESS_KEY',
          secretAccessKey: 'DEFAULT_SECRET',
        },
      },
      get(this.serverless.service, 'custom.appsync-simulator', {}),
    );
    this.simulator = null;

    // Hack: appsync-cli-simulator does not support BatchInvoke.
    removeDataLoader('AWS_LAMBDA');
    addDataLoader('AWS_LAMBDA', LambdaDataLoader);
    addDataLoader('HTTP', NotImplementedDataLoader);
    addDataLoader('RELATIONAL_DATABASE', NotImplementedDataLoader);
    addDataLoader('AMAZON_ELASTICSEARCH', NotImplementedDataLoader);

    this.hooks = {
      'before:offline:start:init': this.startServer.bind(this),
      'before:offline:start:end': this.endServer.bind(this),
    };
  }

  async startServer() {
    try {
      this.simulator = new AmplifyAppSyncSimulator({
        port: this.options.port,
        wsPort: this.options.wsPort,
      });

      await this.simulator.start();

      // TODO: suport several API's
      const appSync = Array.isArray(this.serverless.service.custom.appSync)
        ? this.serverless.service.custom.appSync[0]
        : this.serverless.service.custom.appSync;

      const config = getAppSyncConfig({
        serverless: this.serverless,
        options: this.options,
      }, appSync);


      if (process.env.SLS_DEBUG) {
        this.serverlessLog(`AppSync Config ${appSync.name}`);
        this.serverlessLog(JSON.stringify(config, null, 4));
      }

      this.simulator.init(config);
      this.serverlessLog(`AppSync endpoint: ${this.simulator.url}/graphql`);
      this.serverlessLog(`GraphiQl: ${this.simulator.url}`);
    } catch (error) {
      this.serverlessLog(error);
    }
  }

  endServer() {
    this.serverlessLog('Halting AppSync Simulator');
    this.simulator.stop();
  }
}

module.exports = ServerlessAppSyncSimulator;

import {
  AmplifyAppSyncSimulator,
  addDataLoader,
  removeDataLoader,
} from 'amplify-appsync-simulator';
import { inspect } from 'util';
import { get, merge, reduce } from 'lodash';
import NodeEvaluator from 'cfn-resolver-lib';
import getAppSyncConfig from './getAppSyncConfig';
import LambdaDataLoader from './data-loaders/LambdaDataLoader';
import NotImplementedDataLoader from './data-loaders/NotImplementedDataLoader';
import ElasticDataLoader from './data-loaders/ElasticDataLoader';
import HttpDataLoader from './data-loaders/HttpDataLoader';

const resolverPathMap = {
  'AWS::DynamoDB::Table': 'Properties.TableName',
  'AWS::S3::Bucket': 'Properties.BucketName',
};

class ServerlessAppSyncSimulator {
  constructor(serverless) {
    this.serverless = serverless;
    this.options = merge(
      {
        apiKey: '0123456789',
        port: 20002,
        wsPort: 20003,
        location: '.',
        refMap: {},
        getAttMap: {},
        dynamoDb: {
          endpoint: `http://localhost:${get(this.serverless.service, 'custom.dynamodb.start.port', 8000)}`,
          region: 'localhost',
          accessKeyId: 'DEFAULT_ACCESS_KEY',
          secretAccessKey: 'DEFAULT_SECRET',
        },
      },
      get(this.serverless.service, 'custom.appsync-simulator', {}),
    );
    this.log = this.log.bind(this);
    this.debugLog = this.debugLog.bind(this);

    this.simulator = null;

    // Hack: appsync-cli-simulator does not support BatchInvoke.
    removeDataLoader('AWS_LAMBDA');
    addDataLoader('AWS_LAMBDA', LambdaDataLoader);
    addDataLoader('HTTP', HttpDataLoader);
    addDataLoader('AMAZON_ELASTICSEARCH', ElasticDataLoader);
    addDataLoader('RELATIONAL_DATABASE', NotImplementedDataLoader);

    this.hooks = {
      'before:offline:start:init': this.startServer.bind(this),
      'before:offline:start:end': this.endServer.bind(this),
    };
  }

  log(message, opts = {}) {
    return this.serverless.cli.log(message, 'AppSync Simulator', opts);
  }

  debugLog(message, opts = {}) {
    if (process.env.SLS_DEBUG) {
      this.log(message, opts);
    }
  }

  async startServer() {
    try {
      this.buildResourceResolvers();
      this.serverless.service.functions = this.resolveResources(
        this.serverless.service.functions,
      );
      this.serverless.service.provider.environment = this.resolveResources(
        this.serverless.service.provider.environment,
      );
      this.serverless.service.custom.appSync = this.resolveResources(
        this.serverless.service.custom.appSync,
      );

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
        plugin: this,
        serverless: this.serverless,
        options: this.options,
      }, appSync);

      this.debugLog(`AppSync Config ${appSync.name}`);
      this.debugLog(inspect(config, { depth: 4, colors: true }));

      this.simulator.init(config);
      this.log(`AppSync endpoint: ${this.simulator.url}/graphql`);
      this.log(`GraphiQl: ${this.simulator.url}`);
    } catch (error) {
      this.log(error, { color: 'red' });
    }
  }

  endServer() {
    this.log('Halting AppSync Simulator');
    this.simulator.stop();
  }

  buildResourceResolvers() {
    const refResolvers = reduce(
      get(this.serverless.service, 'resources.Resources', {}),
      (acc, res, name) => {
        const path = resolverPathMap[res.Type];
        if (path !== undefined) {
          return { ...acc, [name]: get(res, path, null) };
        }

        return acc;
      },
      {},
    );

    this.resourceResolvers = {
      RefResolvers: { ...refResolvers, ...this.options.refMap },
      'Fn::GetAttResolvers': this.options.getAttMap,
    };
  }

  /**
   * Resolves resourses through `Ref:` or `Fn:GetAtt`
   */
  resolveResources(input) {
    const evaluator = new NodeEvaluator(input, this.resourceResolvers);
    return evaluator.evaluateNodes();
  }
}

module.exports = ServerlessAppSyncSimulator;

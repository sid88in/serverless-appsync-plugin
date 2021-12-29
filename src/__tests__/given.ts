import { noop, set } from 'lodash';
import Serverless from 'serverless/lib/Serverless';
import AwsProvider from 'serverless/lib/plugins/aws/provider.js';
import { AppSyncConfig } from '../types/plugin';
import ServerlessAppsyncPlugin from '..';
import { logger } from '../utils';

export const createServerless = () => {
  const serverless = new Serverless();
  serverless.setProvider('aws', new AwsProvider(serverless));
  serverless.config.servicePath = '';
  serverless.serviceOutputs = new Map();
  serverless.servicePluginOutputs = new Map();
  set(serverless, 'configurationInput.custom.appSync', []);

  return serverless;
};

export const plugin = () => {
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  return new ServerlessAppsyncPlugin(createServerless(), options, {
    log: logger(noop),
    writeText: noop,
  });
};

export const appSyncConfig = (partial?: Partial<AppSyncConfig>) => {
  const config: AppSyncConfig = {
    name: 'MyApi',
    isSingleConfig: true,
    xrayEnabled: false,
    schema: ['schema.graphql'],
    authentication: {
      type: 'API_KEY',
    },
    additionalAuthenticationProviders: [],
    mappingTemplatesLocation: {
      resolvers: 'path/to/mappingTemplates',
      pipelineFunctions: 'path/to/mappingTemplates',
    },
    resolvers: {},
    pipelineFunctions: {},
    dataSources: {},
    substitutions: {},
    tags: {
      stage: 'Dev',
    },
  };

  return {
    ...config,
    ...partial,
  };
};

import { set } from 'lodash-es';
import Serverless from 'serverless/lib/serverless';
import AwsProvider from 'serverless/lib/plugins/aws/provider.js';
import { AppSyncConfig } from '../types/plugin.js';
import ServerlessAppsyncPlugin from '..';

export const createServerless = (): Serverless => {
  const serverless = new Serverless({
    commands: [],
    options: {},
    configuration: {},
  });
  serverless.setProvider('aws', new AwsProvider(serverless));
  serverless.config.servicePath = '';
  set(serverless, 'configurationInput.appSync', appSyncConfig());

  return serverless;
};

export const plugin = () => {
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  return new ServerlessAppsyncPlugin(createServerless(), options, {
    log: {
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
    },
    progress: {
      create: () => ({
        remove: jest.fn(),
      }),
    },
    writeText: jest.fn(),
  });
};

export const appSyncConfig = (partial?: Partial<AppSyncConfig>) => {
  const config: AppSyncConfig = {
    name: 'MyApi',
    xrayEnabled: false,
    schema: ['schema.graphql'],
    authentication: {
      type: 'API_KEY',
    },
    additionalAuthentications: [],
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

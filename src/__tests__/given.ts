import { set } from 'lodash';
import Serverless from 'serverless/lib/serverless';
import AwsProvider from 'serverless/lib/plugins/aws/provider.js';
import { AppSyncConfig } from '../types/plugin';
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
  return new ServerlessAppsyncPlugin(createServerless(), options);
};

export const appSyncConfig = (partial?: Partial<AppSyncConfig>) => {
  const config: AppSyncConfig = {
    name: 'MyApi',
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

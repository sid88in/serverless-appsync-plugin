import { set } from 'lodash';
import type Serverless from 'serverless/lib/Serverless';
import type Provider from 'serverless/lib/plugins/aws/provider.js';
import { AppSyncConfig } from '../types/plugin';
import ServerlessAppsyncPlugin from '..';

class ServerlessError extends Error {}

// Serverless Framework v4 no longer ships the framework in `node_modules`
// (the `serverless` package is a thin installer; the framework runs from a
// downloaded binary), so unit tests cannot instantiate the real framework via
// `serverless/lib/...`. Instead we build a lightweight fake exposing just the
// surface the plugin constructor and the CFN-compilation paths use. Real-CLI
// synthesis is covered end-to-end by the e2e suite.
export const createServerless = (): Serverless => {
  const provider = {
    naming: {
      getStackName: () => 'MyStack',
      // Mirror Serverless's naming: upper-first + special-char words, so the
      // CFN snapshots keep asserting against real framework behavior.
      getLambdaLogicalId: (functionName: string) =>
        `${functionName
          .replace(/-/g, 'Dash')
          .replace(/_/g, 'Underscore')
          .replace(/^./, (c) => c.toUpperCase())}LambdaFunction`,
    },
    request: jest.fn(),
    getAccountId: () => '123456789012',
    getRegion: () => 'us-east-1',
  } as unknown as Provider;

  const serverless = {
    getProvider: () => provider,
    setProvider: () => undefined,
    configSchemaHandler: {
      defineTopLevelProperty: () => undefined,
    },
    config: { servicePath: '' },
    service: {
      provider: { region: 'us-east-1' },
      setFunctionNames: () => undefined,
    },
    processedInput: { options: {} },
    configurationInput: {},
    addServiceOutputSection: () => undefined,
    classes: { Error: ServerlessError },
  } as unknown as Serverless;

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

declare module '@serverless/utils/log' {
  declare type ServerlessLogger = ((message: string) => void) & {
    error: (message: string) => void;
    warning: (message: string) => void;
    notice: (message: string) => void;
    info: (message: string) => void;
    debug: (message: string) => void;
    success: (message: string) => void;
  };

  declare type ServerlessProgressFactory = {
    create: (params: { name?: string; message: string }) => ServerlessProgress;
    get: (name: string) => ServerlessProgress | undefined;
  };

  declare type ServerlessProgress = {
    update: (message: string) => void;
    remove: () => void;
  };

  export const log: ServerlessLogger;
  export const writeText: (message: string) => void;
  export const progress: ServerlessProgressFactory;
}

declare module 'serverless/lib/Serverless' {
  import { AppSyncConfig } from 'plugin';
  import Provider from 'serverless/lib/plugins/aws/provider.js';
  import type { AWS } from '@serverless/typescript';

  declare interface ServerlessError {
    name: string;
    message: string;
    stack?: string;
    providerError?: Error;
    providerErrorCodeExtension?: string;
  }

  declare interface ServerlessErrorConstructor {
    new (message?: string): ServerlessError;
    (message?: string): ServerlessError;
    readonly prototype: ServerlessError;
  }

  declare type SlsConfig = {
    commands: string[];
    options: object;
    configuration: object;
  };

  declare class Serverless {
    constructor(config: SlsConfig);
    serviceDir: string;
    config: {
      servicePath: string;
    };
    processedInput: {
      functions?: Record<string, unknown>;
      options: Record<string, unknown>;
    };
    configurationInput: AWS & {
      appSync: AppSyncConfig;
    };
    service: AWS & {
      setFunctionNames(rawOptions: Record<string, unknown>): void;
    };
    configSchemaHandler: {
      defineTopLevelProperty: (
        name: string,
        schema: Record<string, unknown>,
      ) => void;
    };
    setProvider: (provider: 'aws', provider: Provider) => void;
    getProvider: (provider: 'aws') => Provider;
    cli: {
      log: (
        message: string,
        entity?: string,
        opts?: Record<string, unknown>,
      ) => void;
    };
    // Serverless v3
    addServiceOutputSection: (
      section: string,
      content: string | string[],
    ) => void;
    classes: {
      Error: ServerlessErrorConstructor;
    };
  }

  export default Serverless;
}

declare module 'serverless/lib/plugins/aws/provider.js' {
  import Serverless from 'serverless/lib/Serverless';
  import { ServiceConfigurationOptions } from 'aws-sdk/lib/service';
  declare class Provider {
    constructor(serverless: Serverless);
    naming: {
      getStackName: () => string;
      getLambdaLogicalId: (functionName: string) => string;
    };
    request: <Input, Output>(
      service: string,
      method: string,
      params: Input,
      options?: ServiceConfigurationOptions,
    ) => Promise<Output>;
  }

  export default Provider;
}

declare module 'serverless' {
  export type Hook = () => void | Promise<void>;

  export type CommandsDefinition = Record<
    string,
    {
      lifecycleEvents?: string[];
      commands?: CommandsDefinition;
      usage?: string;
      options?: {
        [name: string]: {
          usage: string;
          required?: boolean;
          shortcut?: string;
          type?: 'string' | 'boolean' | 'multiple';
        };
      };
    }
  >;

  export type VariablesSourcesDefinition = Record<
    string,
    {
      resolve: VariableSourceResolver;
    }
  >;

  export type VariableSourceResolver = (param: {
    address: string;
    params?: string[];
    options: Record<string, unknown>;
    resolveVariable: (address: string) => string;
  }) => void;
}

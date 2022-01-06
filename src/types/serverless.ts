import type { AWS } from '@serverless/typescript';
import { AppSyncConfigInput } from '../getAppSyncConfig';

export type Hook = () => void | Promise<void>;

export type Provider = {
  naming: {
    getStackName: () => string;
    getLambdaLogicalId: (functionName: string) => string;
  };
  request: <Input, Output>(
    service: string,
    method: string,
    params: Input,
  ) => Promise<Output>;
};

export type Serverless = {
  serviceDir: string;
  config: {
    servicePath: string;
  };
  processedInput: {
    functions?: Record<string, unknown>;
    options: Record<string, unknown>;
  };
  configurationInput: AWS & {
    appSync: AppSyncConfigInput;
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
};

interface ServerlessError {
  name: string;
  message: string;
  stack?: string;
  providerError?: Error;
  providerErrorCodeExtension?: string;
}

interface ServerlessErrorConstructor {
  new (message?: string): ServerlessError;
  (message?: string): ServerlessError;
  readonly prototype: ServerlessError;
}

export type CloudformationTemplate = AWS['resources'];

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

export type CliOptions = Record<string, string | boolean | string[]>;

/**
 * Serverless v3
 */

export type ServerlessLogger = {
  error: (message: string) => void;
  warning: (message: string) => void;
  notice: (message: string) => void;
  info: (message: string) => void;
  debug: (message: string) => void;
  success: (message: string) => void;
};

export type ServerlessProgressFactory = {
  create: (params: { name?: string; message: string }) => ServerlessProgress;
  get: (name: string) => ServerlessProgress;
};

export type ServerlessProgress = {
  update: (message: string) => void;
  remove: () => void;
};

export type ServerlessHelpers = {
  log: ServerlessLogger;
  writeText: (message: string) => void;
  progress: ServerlessProgressFactory;
};

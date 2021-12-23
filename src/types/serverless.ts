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
  configurationInput: AWS & {
    custom: {
      appSync?: AppSyncConfigInput | AppSyncConfigInput[];
    };
  };
  service: AWS & {
    setFunctionNames(rawOptions: Record<string, unknown>): void;
  };
  getProvider: (provider: 'aws') => Provider;
  cli: {
    log: (message: string) => void;
  };
  // Serverless v3
  addServiceOutputSection: (
    section: string,
    content: string | string[],
  ) => void;
  classes: {
    Error: ErrorConstructor;
  };
};

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
      };
    };
  }
>;

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

export type ServerlessHelpers = {
  log: ServerlessLogger;
  writeText: (message: string) => void;
};

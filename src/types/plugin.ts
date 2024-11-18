import type { BuildOptions } from 'esbuild';
import type {
  Auth,
  DomainConfig,
  ApiKeyConfig,
  LoggingConfig,
  CachingConfig,
  WafConfig,
  SyncConfig,
  DsHttpConfig,
  DsDynamoDBConfig,
  DsRelationalDbConfig,
  DsOpenSearchConfig,
  DsLambdaConfig,
  DsEventBridgeConfig,
  DsNone,
  Substitutions,
  EnvironmentVariables,
} from './common';
// import type { IntrinsicFunction } from './cloudFormation';
export * from './common';

// TODO: The same should happen in the validation json schema.
export type BaseAppSyncConfig = {
  dataSources: Record<string, DataSourceConfig>;
  resolvers: Record<string, ResolverConfig>;
  pipelineFunctions: Record<string, PipelineFunctionConfig>;
  substitutions?: Substitutions;
};
export type FullAppSyncConfig = BaseAppSyncConfig & {
  name: string;
  schema?: string[];
  authentication: Auth;
  additionalAuthentications: Auth[];
  domain?: DomainConfig;
  apiKeys?: Record<string, ApiKeyConfig>;
  xrayEnabled?: boolean;
  logging?: LoggingConfig;
  waf?: WafConfig;
  tags?: Record<string, string>;
  // TODO : Check that they can't be overriden in Shared AppSync
  caching?: CachingConfig;
  environment?: EnvironmentVariables;
  visibility?: 'GLOBAL' | 'PRIVATE';
  esbuild?: BuildOptions | false;
  introspection?: boolean;
  queryDepthLimit?: number;
  resolverCountLimit?: number;
};
export type SharedAppSyncConfig = BaseAppSyncConfig & {
  // TODO: Handle IntrinsicFunction
  // apiId?: string | IntrinsicFunction;
  apiId: string;
};
export type AppSyncConfig = FullAppSyncConfig | SharedAppSyncConfig;

export function isSharedApiConfig(
  config: AppSyncConfig,
): config is SharedAppSyncConfig {
  return 'apiId' in config;
}

export type BaseResolverConfig = {
  field: string;
  type: string;
  request?: string | false;
  response?: string | false;
  code?: string;
  caching?:
    | {
        ttl?: number;
        keys?: string[];
      }
    | boolean;
  sync?: SyncConfig;
  substitutions?: Substitutions;
};

export type ResolverConfig = UnitResolverConfig | PipelineResolverConfig;

export type UnitResolverConfig = BaseResolverConfig & {
  kind: 'UNIT';
  dataSource: string;
  maxBatchSize?: number;
};

export type PipelineResolverConfig = BaseResolverConfig & {
  kind?: 'PIPELINE';
  functions: string[];
};

export type DataSourceConfig = {
  name: string;
  description?: string;
} & (
  | DsHttpConfig
  | DsDynamoDBConfig
  | DsRelationalDbConfig
  | DsOpenSearchConfig
  | DsLambdaConfig
  | DsEventBridgeConfig
  | DsNone
);

export type PipelineFunctionConfig = {
  name: string;
  dataSource: string;
  description?: string;
  code?: string;
  request?: string;
  response?: string;
  maxBatchSize?: number;
  substitutions?: Substitutions;
  sync?: SyncConfig;
};
export { Substitutions };

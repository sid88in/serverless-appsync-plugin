//* External typing : Used in serverless.ts
import type { BuildOptions } from 'esbuild';
import type {
  ApiKeyConfig,
  Auth,
  Substitutions,
  CachingConfig,
  DomainConfig,
  LoggingConfig,
  WafConfig,
  DsDynamoDBConfig,
  DsEventBridgeConfig,
  DsHttpConfig,
  DsLambdaConfig,
  DsOpenSearchConfig,
  DsNone,
  DsRelationalDbConfig,
  SyncConfig,
  EnvironmentVariables,
} from './common';
export * from './common';

type BaseAppSyncConfig = {
  dataSources:
    | Record<string, DataSourceConfig>[]
    | Record<string, DataSourceConfig>;
  resolvers?: Record<string, ResolverConfig>[] | Record<string, ResolverConfig>;
  pipelineFunctions?:
    | Record<string, PipelineFunctionConfig>[]
    | Record<string, PipelineFunctionConfig>;
  substitutions?: Substitutions;
};
export type FullAppSyncConfig = BaseAppSyncConfig & {
  name: string;
  schema?: string | string[];
  authentication: Auth;
  additionalAuthentications?: Auth[];
  domain?: DomainConfig;
  apiKeys?: (ApiKeyConfig | string)[];
  environment?: EnvironmentVariables;
  xrayEnabled?: boolean;
  logging?: LoggingConfig;
  caching?: CachingConfig;
  waf?: WafConfig;
  tags?: Record<string, string>;
  visibility?: 'GLOBAL' | 'PRIVATE';
  esbuild?: BuildOptions | false;
  introspection?: boolean;
  queryDepthLimit?: number;
  resolverCountLimit?: number;
};

export type SharedAppSyncConfig = BaseAppSyncConfig & {
  apiId: string;
};

export function isSharedApiConfig(
  config: AppSyncConfig,
): config is SharedAppSyncConfig {
  return 'apiId' in config;
}

export type AppSyncConfig = FullAppSyncConfig | SharedAppSyncConfig;

export type BaseResolverConfig = {
  field?: string;
  type?: string;
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
  dataSource: string | DataSourceConfig;
  maxBatchSize?: number;
};

export type PipelineResolverConfig = BaseResolverConfig & {
  kind?: 'PIPELINE';
  functions: (string | PipelineFunctionConfig)[];
};

export type DataSourceConfig = {
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
  dataSource: string | DataSourceConfig;
  description?: string;
  code?: string;
  request?: string;
  response?: string;
  maxBatchSize?: number;
  substitutions?: Substitutions;
  sync?: SyncConfig;
};

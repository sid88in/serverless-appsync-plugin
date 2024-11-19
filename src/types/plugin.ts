//* Internal typing : Used in the plugin exclusively
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
} from './common.js';
export * from './common.js';

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
  name: string; // Not avalible in external types (index.ts)
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
  name: string; // Not avalible in external types (index.ts)
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

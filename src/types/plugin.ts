import { BuildOptions } from 'esbuild';
import {
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
  EnhancedMetricsConfig
} from './common';
export * from './common';

export type AppSyncConfig = {
  name: string;
  schema: string[];
  authentication: Auth;
  additionalAuthentications: Auth[];
  domain?: DomainConfig;
  apiKeys?: Record<string, ApiKeyConfig>;
  dataSources: Record<string, DataSourceConfig>;
  resolvers: Record<string, ResolverConfig>;
  pipelineFunctions: Record<string, PipelineFunctionConfig>;
  substitutions?: Substitutions;
  environment?: EnvironmentVariables;
  enhancedMetrics?: EnhancedMetricsConfig;
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

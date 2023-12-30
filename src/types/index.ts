import { BuildOptions } from 'esbuild';
import {
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
  DsNone,
  DsOpenSearchConfig,
  DsRelationalDbConfig,
  SyncConfig,
} from './common';
export * from './common';

export type AppSyncConfig = {
  name: string;
  schema?: string | string[];
  authentication: Auth;
  additionalAuthentications?: Auth[];
  domain?: DomainConfig;
  apiKeys?: (ApiKeyConfig | string)[];
  resolvers?: Record<string, ResolverConfig>[] | Record<string, ResolverConfig>;
  pipelineFunctions?:
    | Record<string, PipelineFunctionConfig>[]
    | Record<string, PipelineFunctionConfig>;
  dataSources:
    | Record<string, DataSourceConfig>[]
    | Record<string, DataSourceConfig>;
  substitutions?: Substitutions;
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

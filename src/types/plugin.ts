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
import type { IntrinsicFunction } from './cloudFormation';
export * from './common';

// TODO: Split into multiple configs
//? If most of the parameters are ignored when using apiId 
//? you should define type like this to avoid misusage of the config, 
//? it can be nice for those who use this type in their serverless.ts:
/* ts */ `
  export type BaseAppSyncConfig = {
    dataSources: Record<string, DataSourceConfig>;
    resolvers: Record<string, ResolverConfig>;
    pipelineFunctions: Record<string, PipelineFunctionConfig>;
    substitutions?: Substitutions;
    caching?: CachingConfig;
  };

  export  type NewAppSyncConfig = BaseAppSyncConfig & {
    name: string;
    schema: string[];
    authentication: Auth;
    additionalAuthentications: Auth[];
    domain?: DomainConfig;
    apiKeys?: Record<string, ApiKeyConfig>;
    xrayEnabled?: boolean;
    logging?: LoggingConfig;
    waf?: WafConfig;
    tags?: Record<string, string>;
  };

  export type ExistingAppSyncConfig = BaseAppSyncConfig & {
    apiId: string | IntrinsicFunction;
  };

  export type AppSyncConfig = NewAppSyncConfig | ExistingAppSyncConfig;
`;

//? I agree on this and it joins what I commented earlier.
//? The same should happen in the validation json schema.
//? I would use something like a union.
/* ts */ `
  export type BaseAppSyncConfig = {
    dataSources: Record<string, DataSourceConfig>;
    resolvers: Record<string, ResolverConfig>;
    pipelineFunctions: Record<string, PipelineFunctionConfig>;
    substitutions?: Substitutions;
    caching?: CachingConfig;
  };

  export  type FullAppSyncConfig = BaseAppSyncConfig & {
    name: string;
    schema: string[];
    authentication: Auth;
    additionalAuthentications: Auth[];
    domain?: DomainConfig;
    apiKeys?: Record<string, ApiKeyConfig>;
    xrayEnabled?: boolean;
    logging?: LoggingConfig;
    waf?: WafConfig;
    tags?: Record<string, string>;
  };

  export  type SharedAppSyncConfig = BaseAppSyncConfig & {
    apiId: string;
  };

  export type AppSyncConfig = FullAppSyncConfig | SharedAppSyncConfig
`; //! (not tested, might need adjustments)

export type AppSyncConfig = {
  name: string;
  authentication?: Auth;
  additionalAuthentications: Auth[];
  schema?: string[];
  domain?: DomainConfig;
  apiKeys?: Record<string, ApiKeyConfig>;
  dataSources: Record<string, DataSourceConfig>;
  resolvers: Record<string, ResolverConfig>;
  pipelineFunctions: Record<string, PipelineFunctionConfig>;
  substitutions?: Substitutions;
  environment?: EnvironmentVariables;
  xrayEnabled?: boolean;
  logging?: LoggingConfig;
  caching?: CachingConfig;
  waf?: WafConfig;
  tags?: Record<string, string>;
  apiId?: string | IntrinsicFunction;
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

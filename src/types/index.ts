import { A, O } from 'ts-toolbelt';
import {
  DataSourceConfig as InternalDataSourceConfig,
  ResolverConfig as InternalResolverConfig,
  PipelineFunctionConfig as InternalPipelineFunctionConfig,
  ApiKeyConfig,
  AppSyncConfig as InternalAppSyncConfig,
} from './plugin';

/* Completely replaces keys of O1 with those of O */
type Replace<O extends object, O1 extends object> = O.Merge<
  O,
  O.Omit<O1, A.Keys<O>>
>;

export * from './plugin';

export type DataSourceConfig = O.Omit<InternalDataSourceConfig, 'name'>;

export type PipelineFunctionConfig = Replace<
  { dataSource: string | DataSourceConfig },
  O.Omit<InternalPipelineFunctionConfig, 'name'>
>;

export type ResolverConfigInput = O.Update<
  O.Update<
    O.Optional<InternalResolverConfig, 'type' | 'field'>,
    'dataSource',
    string | DataSourceConfig
  >,
  'functions',
  (string | PipelineFunctionConfig)[]
>;

export type AppSyncConfig = Replace<
  {
    schema?: string | string[];
    apiKeys?: (ApiKeyConfig | string)[];
    resolvers?:
      | Record<string, ResolverConfigInput>[]
      | Record<string, ResolverConfigInput>;
    pipelineFunctions?:
      | Record<string, PipelineFunctionConfig>[]
      | Record<string, PipelineFunctionConfig>;
    dataSources:
      | Record<string, DataSourceConfig>[]
      | Record<string, DataSourceConfig>;
  },
  O.Optional<InternalAppSyncConfig, 'additionalAuthentications'>
>;

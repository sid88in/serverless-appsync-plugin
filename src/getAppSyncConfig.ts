import {
  ApiKeyConfig,
  AppSyncConfig,
  DataSourceConfig,
  FunctionConfig,
  ResolverConfig,
} from './types/plugin';
import { A, O } from 'ts-toolbelt';
import { forEach, merge } from 'lodash';

/* Completely replaces keys of O1 with those of O */
type Replace<O extends object, O1 extends object> = O.Merge<
  O,
  O.Omit<O1, A.Keys<O>>
>;

export type DataSourceConfigInput = O.Optional<DataSourceConfig, 'name'>;

export type ResolverConfigInput =
  | O.Update<
      O.Optional<ResolverConfig, 'type' | 'field'>,
      'dataSource',
      string | DataSourceConfigInput
    >
  | string;

export type FunctionConfigInput =
  | Replace<
      { dataSource: string | DataSourceConfigInput },
      O.Optional<FunctionConfig, 'name'>
    >
  | string;

export type AppSyncConfigInput = Replace<
  {
    schema?: string | string[];
    apiKeys?: (ApiKeyConfig | string)[];
    resolvers?:
      | Record<string, ResolverConfigInput>[]
      | Record<string, ResolverConfigInput>;
    pipelineFunctions?:
      | Record<string, FunctionConfigInput>[]
      | Record<string, FunctionConfigInput>;
    dataSources:
      | Record<string, DataSourceConfigInput>[]
      | Record<string, DataSourceConfigInput>;
  },
  O.Optional<
    AppSyncConfig,
    | 'defaultMappingTemplates'
    | 'mappingTemplatesLocation'
    | 'additionalAuthenticationProviders'
  >
>;

const flattenMaps = <T>(
  input?: Record<string, T> | Record<string, T>[],
): Record<string, T> => {
  if (Array.isArray(input)) {
    return merge({}, ...input);
  } else {
    return merge({}, input);
  }
};

export const isUnitResolver = (resolver: {
  kind?: 'UNIT' | 'PIPELINE';
}): resolver is { kind?: 'UNIT' } => {
  return resolver.kind === undefined || resolver.kind === 'UNIT';
};

export const getAppSyncConfig = (config: AppSyncConfigInput): AppSyncConfig => {
  const schema = Array.isArray(config.schema)
    ? config.schema
    : [config.schema || 'schema.graphql'];
  const mappingTemplatesLocation = merge(
    {
      resolvers: 'mapping-templates',
      pipelineFunctions: 'mapping-templates',
    },
    config.mappingTemplatesLocation,
  );

  const dataSources: DataSourceConfig[] = [];
  const resolvers: ResolverConfig[] = [];
  const pipelineFunctions: FunctionConfig[] = [];

  forEach(flattenMaps(config.dataSources), (ds, name) => {
    dataSources.push({
      ...ds,
      name: ds.name || name,
    });
  });

  forEach(flattenMaps(config.resolvers), (resolver, typeAndField) => {
    const [type, field] = typeAndField.split('.');

    if (typeof resolver === 'string') {
      resolvers.push({
        dataSource: resolver,
        kind: 'UNIT',
        type,
        field,
      });
      return;
    }

    if (isUnitResolver(resolver) && typeof resolver.dataSource === 'object') {
      dataSources.push({
        ...resolver.dataSource,
        name: resolver.dataSource.name || typeAndField.replace(/[^a-z_]/i, '_'),
      });
    }

    resolvers.push({
      ...resolver,
      type: resolver.type || type,
      field: resolver.field || field,
      ...(isUnitResolver(resolver)
        ? {
            kind: 'UNIT',
            dataSource:
              typeof resolver.dataSource === 'object'
                ? resolver.dataSource.name ||
                  typeAndField.replace(/[^a-z_]/i, '_')
                : resolver.dataSource,
          }
        : {
            kind: 'PIPELINE',
            functions: resolver.functions,
          }),
    });
  });

  forEach(flattenMaps(config.pipelineFunctions), (func, name) => {
    if (typeof func === 'string') {
      pipelineFunctions.push({
        name,
        dataSource: func,
      });
      return;
    }

    if (typeof func.dataSource === 'object') {
      dataSources.push({
        ...func.dataSource,
        name: func.dataSource.name || name,
      });
    }

    pipelineFunctions.push({
      ...func,
      dataSource:
        typeof func.dataSource === 'string'
          ? func.dataSource
          : func.dataSource.name || name,
      name: func.name || name,
    });
  });

  const additionalAuthenticationProviders =
    config.additionalAuthenticationProviders || [];

  let apiKeys: ApiKeyConfig[] | undefined;
  if (
    config.authentication.type === 'API_KEY' ||
    additionalAuthenticationProviders.some((auth) => auth.type === 'API_KEY')
  ) {
    const inputKeys = config.apiKeys || [
      {
        name: 'Default',
        description: 'Auto-generated api key',
      },
    ];

    apiKeys = inputKeys.map((key) => {
      if (typeof key === 'string') {
        return { name: key };
      }

      return key;
    });
  }

  return {
    ...config,
    additionalAuthenticationProviders,
    apiKeys,
    schema,
    dataSources,
    mappingTemplatesLocation,
    resolvers,
    pipelineFunctions,
  };
};

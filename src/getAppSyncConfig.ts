import {
  AppSyncConfig,
  isSharedApiConfig,
  PipelineResolverConfig,
  UnitResolverConfig,
} from './types/index.js';

import type {
  ApiKeyConfig,
  AppSyncConfig as PluginAppSyncConfig,
  DataSourceConfig,
  PipelineFunctionConfig,
  ResolverConfig,
  BaseAppSyncConfig,
  SharedAppSyncConfig,
  FullAppSyncConfig,
  Substitutions,
} from './types/plugin.js';
import { forEach, merge } from 'lodash-es';

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
}): resolver is UnitResolverConfig => {
  return resolver.kind === 'UNIT';
};

export const isPipelineResolver = (resolver: {
  kind?: 'UNIT' | 'PIPELINE';
}): resolver is PipelineResolverConfig => {
  return !resolver.kind || resolver.kind === 'PIPELINE';
};

const toResourceName = (name: string) => {
  return name.replace(/[^a-z_]/i, '_');
};

export const getAppSyncConfig = (
  config: AppSyncConfig,
): PluginAppSyncConfig => {
  const baseConfig = getBaseAppsyncConfig(config);

  // handle shared appsync config
  if (isSharedApiConfig(config)) {
    const apiId: string = config.apiId;
    return {
      ...baseConfig,
      apiId,
    } satisfies SharedAppSyncConfig;
  }

  // Handle full appsync config
  const schema = Array.isArray(config.schema)
    ? config.schema
    : [config.schema || 'schema.graphql'];

  const additionalAuthentications = config.additionalAuthentications || [];

  let apiKeys: Record<string, ApiKeyConfig> | undefined;
  if (
    config.authentication?.type === 'API_KEY' ||
    additionalAuthentications.some((auth) => auth.type === 'API_KEY')
  ) {
    const inputKeys = config.apiKeys || [];

    apiKeys = inputKeys.reduce((acc, key) => {
      if (typeof key === 'string') {
        acc[key] = { name: key };
      } else {
        acc[key.name] = key;
      }

      return acc;
    }, {});
  }

  return {
    ...config,
    ...baseConfig,
    additionalAuthentications,
    apiKeys,
    schema,
  } satisfies FullAppSyncConfig;
};

function getBaseAppsyncConfig(config: AppSyncConfig): BaseAppSyncConfig {
  const dataSources: Record<string, DataSourceConfig> = {};
  const resolvers: Record<string, ResolverConfig> = {};
  const pipelineFunctions: Record<string, PipelineFunctionConfig> = {};
  const substitutions: Substitutions = {};

  forEach(flattenMaps(config.dataSources), (ds, name) => {
    dataSources[name] = {
      ...ds,
      name,
    };
  });

  forEach(flattenMaps(config.resolvers), (resolver, typeAndField) => {
    const [type, field] = typeAndField.split('.');

    if (typeof resolver === 'string') {
      resolvers[typeAndField] = {
        dataSource: resolver,
        kind: 'UNIT',
        type,
        field,
      };
      return;
    }

    if (isUnitResolver(resolver) && typeof resolver.dataSource === 'object') {
      const name = typeAndField.replace(/[^a-z_]/i, '_');
      dataSources[name] = {
        ...resolver.dataSource,
        name,
      };
    }

    resolvers[typeAndField] = {
      ...resolver,
      type: resolver.type || type,
      field: resolver.field || field,
      ...(isUnitResolver(resolver)
        ? {
            kind: 'UNIT',
            dataSource:
              typeof resolver.dataSource === 'object'
                ? typeAndField.replace(/[^a-z_]/i, '_')
                : resolver.dataSource,
          }
        : {
            kind: 'PIPELINE',
            functions: resolver.functions.map((f, index) => {
              if (typeof f === 'string') {
                return f;
              }

              const name = `${toResourceName(typeAndField)}_${index}`;
              pipelineFunctions[name] = {
                ...f,
                name,
                dataSource:
                  typeof f.dataSource === 'string' ? f.dataSource : name,
              };
              if (typeof f.dataSource === 'object') {
                dataSources[name] = {
                  ...f.dataSource,
                  name,
                };
              }
              return name;
            }),
          }),
    };
  });

  forEach(flattenMaps(config.pipelineFunctions), (func, name) => {
    if (typeof func.dataSource === 'object') {
      dataSources[name] = {
        ...func.dataSource,
        name,
      };
    }

    pipelineFunctions[name] = {
      ...func,
      dataSource: typeof func.dataSource === 'string' ? func.dataSource : name,
      name,
    };
  });

  if (config.substitutions) {
    Object.assign(substitutions, config.substitutions);
  }

  return {
    dataSources,
    resolvers,
    pipelineFunctions,
    substitutions,
  };
}

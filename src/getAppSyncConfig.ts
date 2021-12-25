import {
  ApiKeyConfig,
  AppSyncConfig,
  Auth,
  DataSourceConfig,
  FunctionConfig,
  ResolverConfig,
  Substitutions,
  WafActionKeys,
  WafRule,
} from './types/plugin';
import { IntrinsicFunction } from './types/cloudFormation';
import { O } from 'ts-toolbelt';
import { forEach, merge } from 'lodash';

const flattenAndMerge = <T>(
  input?: Record<string, T> | Record<string, T>[],
): Record<string, T> => {
  if (Array.isArray(input)) {
    return merge({}, ...input);
  } else {
    return merge({}, input);
  }
};

export type ResolverConfigInput =
  | O.Update<
      O.Optional<ResolverConfig, 'type' | 'field'>,
      'dataSource',
      string | DataSourceConfigInput
    >
  | string;

export type FunctionConfigInput =
  | O.Update<
      O.Optional<FunctionConfig, 'name'>,
      'dataSource',
      string | DataSourceConfigInput
    >
  | string;
export type DataSourceConfigInput = O.Optional<DataSourceConfig, 'name'>;

export type AppSyncConfigInput = {
  apiId?: string;
  name: string;
  schema?: string | string[];
  authentication: Auth;
  apiKeys?: (ApiKeyConfig | string)[];
  caching?: {
    behavior: 'FULL_REQUEST_CACHING' | 'PER_RESOLVER_CACHING';
    type?: string;
    ttl?: number;
    atRestEncryption?: boolean;
    transitEncryption?: boolean;
  };
  additionalAuthenticationProviders?: Auth[];
  logConfig?: {
    loggingRoleArn?: string | IntrinsicFunction;
    level?: 'ERROR' | 'NONE' | 'ALL';
    excludeVerboseContent?: boolean;
  };
  defaultMappingTemplates?: {
    request?: string | false;
    response?: string | false;
  };
  mappingTemplatesLocation?: {
    resolvers?: string;
    pipelineFunctions?: string;
  };
  resolvers?:
    | Record<string, ResolverConfigInput>[]
    | Record<string, ResolverConfigInput>;
  pipelineFunctions?:
    | Record<string, FunctionConfigInput>[]
    | Record<string, FunctionConfigInput>;
  dataSources:
    | Record<string, DataSourceConfigInput>[]
    | Record<string, DataSourceConfigInput>;
  substitutions?: Substitutions;
  xrayEnabled?: boolean;
  wafConfig?: {
    enabled?: boolean;
    name: string;
    defaultAction: WafActionKeys;
    description?: string;
    rules: WafRule[];
  };
  tags?: Record<string, string>;
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

  forEach(flattenAndMerge(config.dataSources), (ds, name) => {
    dataSources.push({
      ...ds,
      name: ds.name || name,
    });
  });

  forEach(flattenAndMerge(config.resolvers), (resolver, typeAndField) => {
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

  forEach(flattenAndMerge(config.pipelineFunctions), (func, name) => {
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

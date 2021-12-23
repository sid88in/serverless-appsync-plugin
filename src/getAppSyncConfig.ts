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
import { map, merge } from 'lodash';

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
  | O.Optional<ResolverConfig, 'type' | 'field'>
  | string;
export type FunctionConfigInput = O.Optional<FunctionConfig, 'name'>;
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

  const dataSources = map(flattenAndMerge(config.dataSources), (ds, name) => {
    return { ...ds, name: ds.name || name };
  });

  const resolvers: ResolverConfig[] = map(
    flattenAndMerge(config.resolvers),
    (resolver, typeAndField) => {
      const [type, field] = typeAndField.split('.');

      if (typeof resolver === 'string') {
        return {
          dataSource: resolver,
          kind: 'UNIT',
          type,
          field,
        };
      }

      return {
        ...resolver,
        type: resolver.type || type,
        field: resolver.field || field,
      };
    },
  );

  const pipelineFunctions = map(
    flattenAndMerge(config.pipelineFunctions),
    (ds, name) => {
      return { ...ds, name: ds.name || name };
    },
  );

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

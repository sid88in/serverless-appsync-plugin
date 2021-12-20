import fs from 'fs';
import path from 'path';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { has, mapObjIndexed, pipe, values } from 'ramda';
import globby from 'globby';
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
import { AWS } from '@serverless/typescript';
import { convertAppSyncSchemas } from 'appsync-schema-converter';
import { IntrinsicFunction } from './types/cloudFormation';

const objectToArrayWithNameProp = pipe(
  mapObjIndexed(
    (item: DataSourceConfig | Omit<DataSourceConfig, 'name'>, key) =>
      ({
        name: key,
        ...item,
      } as DataSourceConfig),
  ),
  values,
);

const readSchemaFile = (filePath: string) =>
  fs.readFileSync(filePath, { encoding: 'utf8' });

const mergeTypes = (types) => {
  return mergeTypeDefs(types, {
    useSchemaDefinition: true,
    forceSchemaDefinition: true,
    throwOnConflict: true,
    commentDescriptions: true,
    reverseDirectives: true,
  });
};

const buildAppSyncSchema = (schemaFiles: string[]) => {
  // Merge files
  const mergedSchema = mergeTypes(schemaFiles.map(readSchemaFile));

  return convertAppSyncSchemas(mergedSchema);
};

export type AppSyncConfigInput = {
  apiId?: string;
  name?: string;
  schema?: string | string[];
  authentication: Auth;
  apiKeys?: ApiKeyConfig[];
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
  mappingTemplatesLocation?: string;
  functionConfigurationsLocation?: string;
  mappingTemplates?: ResolverConfig[];
  functionConfigurations?: FunctionConfig[];
  dataSources:
    | (DataSourceConfig | Record<string, DataSourceConfig>)[]
    | Record<string, DataSourceConfig>;
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

export const getAppSyncConfig = async (
  config: AppSyncConfigInput,
  provider: AWS['provider'],
  servicePath: string,
): Promise<AppSyncConfig> => {
  const mappingTemplatesLocation =
    config.mappingTemplatesLocation || 'mapping-templates';
  const functionConfigurationsLocation =
    config.functionConfigurationsLocation || mappingTemplatesLocation;
  const functionConfigurations: FunctionConfig[] = (
    config.functionConfigurations || []
  ).reduce(
    (accumulator, currentValue) => accumulator.concat(currentValue),
    [] as FunctionConfig[],
  );
  const mappingTemplates: ResolverConfig[] = (
    config.mappingTemplates || []
  ).reduce(
    (accumulator, currentValue) => accumulator.concat(currentValue),
    [] as ResolverConfig[],
  );

  const toAbsolutePosixPath = (filePath: string) =>
    (path.isAbsolute(filePath)
      ? filePath
      : path.join(servicePath, filePath)
    ).replace(/\\/g, '/');

  const schema = Array.isArray(config.schema)
    ? config.schema
    : [config.schema || 'schema.graphql'];
  const schemaFiles = ([] as string[]).concat(
    ...schema.map((s) => globby.sync(toAbsolutePosixPath(s))),
  );

  const schemaContent = buildAppSyncSchema(schemaFiles);

  let dataSources: DataSourceConfig[] = [];
  if (Array.isArray(config.dataSources)) {
    dataSources = config.dataSources.reduce((acc, value) => {
      // Do not call `objectToArrayWithNameProp` on datasources objects``
      if (has('name')(value)) {
        return acc.concat(value);
      } else {
        return acc.concat(objectToArrayWithNameProp(value));
      }
    }, [] as DataSourceConfig[]);
  } else if (config.dataSources) {
    dataSources = objectToArrayWithNameProp(config.dataSources);
  }

  return {
    ...config,
    name: config.name || 'api',
    region: provider.region || 'us-east-1',
    additionalAuthenticationProviders:
      config.additionalAuthenticationProviders || [],
    schema: schemaContent,
    // TODO verify dataSources structure
    dataSources,
    defaultMappingTemplates: config.defaultMappingTemplates || {},
    mappingTemplatesLocation,
    mappingTemplates,
    functionConfigurationsLocation,
    functionConfigurations,
    substitutions: config.substitutions || {},
    xrayEnabled: config.xrayEnabled || false,
  };
};

export const getConfig = async (
  config: AppSyncConfigInput | AppSyncConfigInput[],
  provider: AWS['provider'],
  servicePath: string,
) => {
  if (!config) {
    return [];
  } else if (Array.isArray(config)) {
    const conf: AppSyncConfig[] = [];
    for (const key in config) {
      conf.push(await getAppSyncConfig(config[key], provider, servicePath));
    }
    return conf;
  }

  const singleConfig = await getAppSyncConfig(config, provider, servicePath);
  singleConfig.isSingleConfig = true;

  return [singleConfig];
};

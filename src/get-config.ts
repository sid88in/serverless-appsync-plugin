import fs from 'fs';
import path from 'path';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { has, mapObjIndexed, pipe, values } from 'ramda';
import globby from 'globby';
import {
  ApiKeyConfig,
  AppSyncConfig,
  Auth,
  DataSource,
  FunctionConfig,
  IntrinsictFunction,
  Resolver,
  WafRule,
} from './types';
import { AWS } from '@serverless/typescript';
import { convertAppSyncSchemas } from 'appsync-schema-converter';

const objectToArrayWithNameProp = pipe(
  mapObjIndexed(
    (item: DataSource | Omit<DataSource, 'name'>, key) =>
      ({
        name: key,
        ...item,
      } as DataSource),
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
  const mergedSchema = mergeTypes(schemaFiles.map(readSchemaFile))
    .replace(/ *#+(.*)/g, '"""\n$1\n"""')
    .replace(/"""\n"""\n/, '');

  return convertAppSyncSchemas(mergedSchema);
};

export type AppSyncConfigInput = {
  apiId?: string;
  allowHashDescription?: boolean;
  isSingleConfig?: boolean;
  name?: string;
  region: string;
  schema: string | string[];
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
    loggingRoleArn?: string | IntrinsictFunction;
    level?: 'ERROR' | 'NONE' | 'ALL';
    excludeVerboseContent?: boolean;
  };
  defaultMappingTemplates?: {
    request?: string | false;
    response?: string | false;
  };
  mappingTemplatesLocation?: string;
  functionConfigurationsLocation?: string;
  mappingTemplates?: Resolver[];
  functionConfigurations?: FunctionConfig[];
  dataSources:
    | (DataSource | Record<string, DataSource>)[]
    | Record<string, DataSource>;
  substitutions?: Record<string, string | IntrinsictFunction>;
  xrayEnabled?: boolean;
  wafConfig?: {
    enabled: boolean;
    name: string;
    defaultAction: 'Allow' | 'Block';
    description?: string;
    rules: WafRule[];
  };
  tags?: Record<string, string>;
} & Auth;

const getAppSyncConfig = async (
  config: AppSyncConfigInput,
  provider: AWS['provider'],
  servicePath: string,
): Promise<AppSyncConfig> => {
  if (
    !(
      config.apiId ||
      config.authenticationType === 'API_KEY' ||
      config.authenticationType === 'AWS_IAM' ||
      config.authenticationType === 'AMAZON_COGNITO_USER_POOLS' ||
      config.authenticationType === 'OPENID_CONNECT' ||
      config.authenticationType === 'AWS_LAMBDA'
    )
  ) {
    throw new Error(
      'appSync property `authenticationType` is missing or invalid.',
    );
  }

  if (
    config.authenticationType === 'AMAZON_COGNITO_USER_POOLS' &&
    !has('userPoolConfig', config)
  ) {
    throw new Error(
      'appSync property `userPoolConfig` is required when authenticationType `AMAZON_COGNITO_USER_POOLS` is chosen.',
    );
  }
  if (
    config.authenticationType === 'AWS_LAMBDA' &&
    !has('lambdaAuthorizerConfig', config)
  ) {
    throw new Error(
      'appSync property `lambdaAuthorizerConfig` is required when authenticationType `AWS_LAMBDA` is chosen.',
    );
  }
  if (
    config.authenticationType === 'OPENID_CONNECT' &&
    !has('openIdConnectConfig', config)
  ) {
    throw new Error(
      'appSync property `openIdConnectConfig` is required when authenticationType `OPENID_CONNECT` is chosenXXX.',
    );
  }

  if (config.logConfig && !config.logConfig.level) {
    throw new Error(
      'logConfig property `level` must be NONE, ERROR, or ALL when logConfig exists.',
    );
  }
  if (config.substitutions && typeof config.substitutions !== 'object') {
    throw new Error('substitutions property must be an object');
  }
  if (config.xrayEnabled && typeof config.xrayEnabled !== 'boolean') {
    throw new Error('xrayEnabled must be a boolean');
  }

  const mappingTemplatesLocation =
    config.mappingTemplatesLocation || 'mapping-templates';
  const functionConfigurationsLocation =
    config.functionConfigurationsLocation || mappingTemplatesLocation;
  const functionConfigurations: FunctionConfig[] =
    config.functionConfigurations || [];
  const mappingTemplates: Resolver[] = config.mappingTemplates || [];

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

  let dataSources: DataSource[] = [];
  if (Array.isArray(config.dataSources)) {
    dataSources = config.dataSources.reduce((acc, value) => {
      // Do not call `objectToArrayWithNameProp` on datasources objects``
      if (has('name')(value)) {
        return acc.concat(value);
      } else {
        return acc.concat(objectToArrayWithNameProp(value));
      }
    }, [] as DataSource[]);
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

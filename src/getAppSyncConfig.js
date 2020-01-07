import {
  AmplifyAppSyncSimulatorAuthenticationType as AuthTypes,
} from 'amplify-appsync-simulator';
import { invoke } from 'amplify-util-mock/lib/utils/lambda/invoke';
import fs from 'fs';
import { find } from 'lodash';
import path from 'path';

export default function getAppSyncConfig(context, appSyncConfig) {
  // Flattening params
  const cfg = {
    ...appSyncConfig,
    mappingTemplates: (appSyncConfig.mappingTemplates || []).flat(),
    functionConfigurations: (appSyncConfig.functionConfigurations || []).flat(),
    dataSources: (appSyncConfig.dataSources || []).flat(),
  };

  const getFileMap = (basePath, filePath) => ({
    path: filePath,
    content: fs.readFileSync(path.join(basePath, filePath), { encoding: 'utf8' }),
  });

  const makeDataSource = (source) => {
    if (source.name === undefined || source.type === undefined) {
      return null;
    }

    const dataSource = {
      name: source.name,
      type: source.type,
    };

    switch (source.type) {
      case 'AMAZON_DYNAMODB': {
        const {
          endpoint,
          region,
          accessKeyId,
          secretAccessKey,
        } = context.options.dynamoDb;

        return {
          ...dataSource,
          config: {
            endpoint,
            region,
            accessKeyId,
            secretAccessKey,
            tableName: source.config.tableName,
          },
        };
      }
      case 'AWS_LAMBDA': {
        const { functionName } = source.config;
        if (functionName === undefined) {
          context.plugin.log(
            `${source.name} does not have a functionName`,
            { color: 'orange' },
          );
          return null;
        }
        const func = context.serverless.service.functions[functionName];
        if (func === undefined) {
          context.plugin.log(
            `The ${functionName} function is not defined`,
            { color: 'orange' },
          );
          return null;
        }
        const [fileName, handler] = func.handler.split('.');
        return {
          ...dataSource,
          invoke: (payload) => invoke({
            packageFolder: context.serverless.config.servicePath,
            handler,
            fileName: path.join(context.options.location, fileName),
            event: payload,
            environment: {
              ...context.serverless.service.provider.environment,
              ...func.environment,
            },
          }),
        };
      }
      case 'AMAZON_ELASTICSEARCH':
      case 'HTTP': {
        return {
          ...dataSource,
          endpoint: source.config.endpoint,
        };
      }
      default:
        return dataSource;
    }
  };

  const makeResolver = (resolver) => ({
    kind: resolver.kind || 'UNIT',
    fieldName: resolver.field,
    typeName: resolver.type,
    dataSourceName: resolver.dataSource,
    functions: resolver.functions,
    requestMappingTemplateLocation: resolver.request || `${resolver.type}.${resolver.field}.request.vtl`,
    responseMappingTemplateLocation: resolver.response || `${resolver.type}.${resolver.field}.response.vtl`,
  });

  const makeFunctionConfiguration = (functionConfiguration) => ({
    dataSourceName: functionConfiguration.dataSource,
    name: functionConfiguration.name,
    requestMappingTemplateLocation: functionConfiguration.request,
    responseMappingTemplateLocation: functionConfiguration.response,
  });

  const makeAuthType = (authType) => {
    const auth = {
      authenticationType: authType.authenticationType,
    };

    if (auth.authenticationType === AuthTypes.AMAZON_COGNITO_USER_POOLS) {
      auth.cognitoUserPoolConfig = {
        AppIdClientRegex: authType.userPoolConfig.appIdClientRegex,
      };
    } else if (auth.authenticationType === AuthTypes.OPENID_CONNECT) {
      auth.openIDConnectConfig = {
        Issuer: authType.openIdConnectConfig.issuer,
        ClientId: authType.openIdConnectConfig.clientId,
      };
    }

    return auth;
  };

  const makeAppSync = (config) => ({
    name: config.name,
    apiKey: context.options.apiKey,
    defaultAuthenticationType: makeAuthType(config),
    additionalAuthenticationProviders: (config.additionalAuthenticationProviders || [])
      .map(makeAuthType),
  });

  const mappingTemplatesLocation = path.join(
    context.serverless.config.servicePath,
    cfg.mappingTemplatesLocation || 'mapping-templates',
  );

  const makeMappingTemplates = (config) => {
    const sources = [].concat(
      config.mappingTemplates,
      config.functionConfigurations,
    );

    return sources.reduce((acc, template) => {
      const requestTemplate = template.request || `${template.type}.${template.field}.request.vtl`;
      if (!find(acc, (e) => e.path === requestTemplate)) {
        acc.push(getFileMap(mappingTemplatesLocation, requestTemplate));
      }
      const responseTemplate = template.response || `${template.type}.${template.field}.response.vtl`;
      if (!find(acc, (e) => e.path === responseTemplate)) {
        acc.push(getFileMap(mappingTemplatesLocation, responseTemplate));
      }

      return acc;
    }, []);
  };

  return {
    appSync: makeAppSync(cfg),
    schema: getFileMap(context.serverless.config.servicePath, cfg.schema || 'schema.graphql'),
    resolvers: cfg.mappingTemplates.map(makeResolver),
    dataSources: cfg.dataSources.map(makeDataSource).filter((v) => v !== null),
    functions: cfg.functionConfigurations.map(makeFunctionConfiguration),
    mappingTemplates: makeMappingTemplates(cfg),
  };
}

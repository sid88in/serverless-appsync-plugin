import {
  AmplifyAppSyncSimulatorAuthenticationType as AuthTypes,
} from 'amplify-appsync-simulator';
import { invoke } from 'amplify-util-mock/lib/utils/lambda/invoke';
import fs from 'fs';
import { forEach } from 'lodash';
import path from 'path';

export default function getAppSyncConfig(context, appSyncConfig) {
  // Flattening params
  const cfg = {
    ...appSyncConfig,
    mappingTemplates: (appSyncConfig.mappingTemplates || []).flat(),
    functionConfigurations: (appSyncConfig.functionConfigurations || []).flat(),
    dataSources: (appSyncConfig.dataSources || []).flat(),
  };

  const getFileMap = (basePath, filePath, substitutionPath = null) => ({
    path: substitutionPath || filePath,
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

  const getDefaultTemplatePrefix = (template) => {
    const { name, type, field } = template;
    return name ? `${name}` : `${type}.${field}`;
  };

  const makeResolver = (resolver) => ({
    kind: resolver.kind || 'UNIT',
    fieldName: resolver.field,
    typeName: resolver.type,
    dataSourceName: resolver.dataSource,
    functions: resolver.functions,
    requestMappingTemplateLocation: `${getDefaultTemplatePrefix(resolver)}.request.vtl`,
    responseMappingTemplateLocation: `${getDefaultTemplatePrefix(resolver)}.response.vtl`,
  });

  const makeFunctionConfiguration = (functionConfiguration) => ({
    dataSourceName: functionConfiguration.dataSource,
    name: functionConfiguration.name,
    requestMappingTemplateLocation: `${getDefaultTemplatePrefix(functionConfiguration)}.request.vtl`,
    responseMappingTemplateLocation: `${getDefaultTemplatePrefix(functionConfiguration)}.response.vtl`,
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

  const makeMappingTemplate = (filePath, substitutionPath = null, substitutions = {}) => {
    const mapping = getFileMap(mappingTemplatesLocation, filePath, substitutionPath);

    forEach(substitutions, (value, variable) => {
      const regExp = new RegExp(`\\$\{?${variable}}?`, 'g');
      mapping.content = mapping.content.replace(regExp, value);
    });

    return mapping;
  };

  const makeMappingTemplates = (config) => {
    const sources = [].concat(
      config.mappingTemplates,
      config.functionConfigurations,
    );

    return sources.reduce((acc, template) => {
      const {
        substitutions = {},
        request,
        response,
      } = template;

      const defaultTemplatePrefix = getDefaultTemplatePrefix(template);

      const requestTemplate = request || `${defaultTemplatePrefix}.request.vtl`;
      const responseTemplate = response || `${defaultTemplatePrefix}.response.vtl`;

      // Substitutions
      const allSubstitutions = { ...config.substitutions, ...substitutions };
      return [
        ...acc,
        makeMappingTemplate(requestTemplate, `${defaultTemplatePrefix}.request.vtl`, allSubstitutions),
        makeMappingTemplate(responseTemplate, `${defaultTemplatePrefix}.response.vtl`, allSubstitutions),
      ];
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

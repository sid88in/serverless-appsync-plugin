import {
  AmplifyAppSyncSimulatorAuthenticationType as AuthTypes,
} from 'amplify-appsync-simulator';
import { invoke } from 'amplify-util-mock/lib/utils/lambda/invoke';
import fs from 'fs';
import { find } from 'lodash';
import path from 'path';

export default function getAppSyncConfig(context, appSyncConfig) {
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
        const { port } = context.options.dynamoDb;
        return {
          ...dataSource,
          config: {
            endpoint: `http://localhost:${port}`,
            region: 'localhost',
            tableName: source.config.tableName, // FIXME: Handle Ref:
          },
        };
      }
      case 'AWS_LAMBDA': {
        const { functionName } = source.config;
        if (context.serverless.service.functions[functionName] === undefined) {
          return null;
        }

        const [fileName, handler] = context.serverless.service.functions[functionName].handler.split('.');
        return {
          ...dataSource,
          invoke: (payload) => invoke({
            packageFolder: context.serverless.config.servicePath,
            handler,
            fileName: path.join(context.options.location, fileName),
            event: payload,
            environment: context.serverless.service.provider.environment || {},
          }),
        };
      }
      default:
        return dataSource;
    }
  };

  const makeResolver = (resolver) => ({
    kind: 'UNIT',
    fieldName: resolver.field,
    typeName: resolver.type,
    dataSourceName: resolver.dataSource,
    requestMappingTemplateLocation: resolver.request,
    responseMappingTemplateLocation: resolver.response,
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

  const makeAppSync = () => ({
    name: appSyncConfig.name,
    apiKey: context.options.apiKey || '123456',
    defaultAuthenticationType: makeAuthType(appSyncConfig),
    additionalAuthenticationProviders: (appSyncConfig.additionalAuthenticationProviders || [])
      .map(makeAuthType),
  });

  const mappingTemplatesLocation = path.join(
    context.serverless.config.servicePath,
    appSyncConfig.mappingTemplatesLocation || 'mapping-templates',
  );

  return {
    appSync: makeAppSync(),
    schema: getFileMap(context.serverless.config.servicePath, appSyncConfig.schema || 'schema.graphql'),
    resolvers: appSyncConfig.mappingTemplates.map(makeResolver),
    dataSources: appSyncConfig.dataSources.map(makeDataSource).filter((v) => v !== null),
    mappingTemplates: appSyncConfig.mappingTemplates.reduce((acc, template) => {
      const requestTemplate = template.request || `${template.type}.${template.field}.request.vtl`;
      if (!find(acc, (e) => e.path === requestTemplate)) {
        acc.push(getFileMap(mappingTemplatesLocation, requestTemplate));
      }
      const responseTemplate = template.response || `${template.type}.${template.field}.response.vtl`;
      if (!find(acc, (e) => e.path === responseTemplate)) {
        acc.push(getFileMap(mappingTemplatesLocation, responseTemplate));
      }

      return acc;
    }, []),
  };
}

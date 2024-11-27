import {
  CfnResolver,
  CfnResource,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation.js';
import { isSharedApiConfig, ResolverConfig } from '../types/plugin.js';
import { Api } from './Api.js';
import path from 'path';
import { MappingTemplate } from './MappingTemplate.js';
import { SyncConfig } from './SyncConfig.js';
import { JsResolver } from './JsResolver.js';
import { Naming } from './Naming.js';

// A decent default for pipeline JS resolvers
const DEFAULT_JS_RESOLVERS = `
export function request() {
  return {};
}

export function response(ctx) {
  return ctx.prev.result;
}
`;

export class Resolver {
  constructor(private api: Api, private config: ResolverConfig) {}

  compile(): CfnResources {
    let Properties: CfnResolver['Properties'] = {
      ApiId: this.api.getApiId(),
      TypeName: this.config.type,
      FieldName: this.config.field,
    };

    const isVTLResolver = 'request' in this.config || 'response' in this.config;
    const isJsResolver =
      'code' in this.config || (!isVTLResolver && this.config.kind !== 'UNIT');

    if (isJsResolver) {
      if (this.config.code) {
        Properties.Code = this.resolveJsCode(this.config.code);
      } else {
        // default for pipeline JS resolvers
        Properties.Code = DEFAULT_JS_RESOLVERS;
      }
      Properties.Runtime = {
        Name: 'APPSYNC_JS',
        RuntimeVersion: '1.0.0',
      };
    } else if (isVTLResolver) {
      const requestMappingTemplates = this.resolveMappingTemplate('request');
      if (requestMappingTemplates) {
        Properties.RequestMappingTemplate = requestMappingTemplates;
      }

      const responseMappingTemplate = this.resolveMappingTemplate('response');
      if (responseMappingTemplate) {
        Properties.ResponseMappingTemplate = responseMappingTemplate;
      }
    }

    if (isSharedApiConfig(this.api.config)) {
      // Todo : [feature] handle resolvers caching & sync with config from the parent stack
      this.api.plugin.utils.log.warning(
        'caching and sync config are ignored for shared appsync',
      );
    } else {
      if (this.config.caching) {
        if (this.config.caching === true) {
          // Use defaults
          Properties.CachingConfig = {
            Ttl: this.api.config.caching?.ttl || 3600,
          };
        } else if (typeof this.config.caching === 'object') {
          Properties.CachingConfig = {
            CachingKeys: this.config.caching.keys,
            Ttl:
              this.config.caching.ttl || this.api.config.caching?.ttl || 3600,
          };
        }
      }

      if (this.config.sync) {
        const asyncConfig = new SyncConfig(this.api, this.config);
        Properties.SyncConfig = asyncConfig.compile();
      }
    }

    if (this.config.kind === 'UNIT') {
      const { dataSource } = this.config;
      // TODO: [feature] support existing datasource (by providing an id ?)
      if (!this.api.hasDataSource(dataSource)) {
        throw new this.api.plugin.serverless.classes.Error(
          `Resolver '${this.config.type}.${this.config.field}' references unknown DataSource '${dataSource}'`,
        );
      }

      const logicalIdDataSource = Naming.getDataSourceLogicalId(dataSource);
      Properties = {
        ...Properties,
        Kind: 'UNIT',
        DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
        MaxBatchSize: this.config.maxBatchSize,
      };
    } else {
      Properties = {
        ...Properties,
        Kind: 'PIPELINE',
        PipelineConfig: {
          Functions: this.config.functions.map((name) => {
            if (!this.api.hasPipelineFunction(name)) {
              throw new this.api.plugin.serverless.classes.Error(
                `Resolver '${this.config.type}.${this.config.field}' references unknown Pipeline function '${name}'`,
              );
            }

            const logicalIdDataSource =
              Naming.getPipelineFunctionLogicalId(name);
            return { 'Fn::GetAtt': [logicalIdDataSource, 'FunctionId'] };
          }),
        },
      };
    }

    const logicalResolver: CfnResource = {
      Type: 'AWS::AppSync::Resolver',
      Properties,
    };

    // Add dependacy to the schema for the full appsync configs
    if (!isSharedApiConfig(this.api.config)) {
      if (!this.api.naming)
        throw new this.api.plugin.serverless.classes.Error(
          'Unable to load the naming module',
        );
      logicalResolver.DependsOn = [this.api.naming.getSchemaLogicalId()];
    }

    const logicalIdResolver = Naming.getResolverLogicalId(
      this.config.type,
      this.config.field,
    );

    return {
      [logicalIdResolver]: logicalResolver,
    };
  }

  resolveJsCode = (filePath: string): string | IntrinsicFunction => {
    const codePath = path.join(
      this.api.plugin.serverless.config.servicePath,
      filePath,
    );

    const template = new JsResolver(this.api, {
      path: codePath,
      substitutions: this.config.substitutions,
    });

    return template.compile();
  };

  resolveMappingTemplate(
    type: 'request' | 'response',
  ): string | IntrinsicFunction | undefined {
    const templateName = this.config[type];

    if (templateName) {
      const templatePath = path.join(
        this.api.plugin.serverless.config.servicePath,
        templateName,
      );
      const template = new MappingTemplate(this.api, {
        path: templatePath,
        substitutions: this.config.substitutions,
      });

      return template.compile();
    }
  }
}

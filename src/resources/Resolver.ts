import {
  CfnResolver,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation';
import { ResolverConfig } from '../types/plugin';
import { Api } from './Api';
import path from 'path';
import { MappingTemplate } from './MappingTemplate';
import { SyncConfig } from './SyncConfig';

export class Resolver {
  constructor(private api: Api, private config: ResolverConfig) {}

  compile(): CfnResources {
    let Properties: CfnResolver['Properties'] = {
      ApiId: this.api.getApiId(),
      TypeName: this.config.type,
      FieldName: this.config.field,
    };

    const requestMappingTemplates = this.resolveMappingTemplate('request');
    if (requestMappingTemplates) {
      Properties.RequestMappingTemplate = requestMappingTemplates;
    }

    const responseMappingTemplate = this.resolveMappingTemplate('response');
    if (responseMappingTemplate) {
      Properties.ResponseMappingTemplate = responseMappingTemplate;
    }

    if (this.config.caching) {
      if (this.config.caching === true) {
        // Use defaults
        Properties.CachingConfig = {
          Ttl: this.api.config.caching?.ttl || 3600,
        };
      } else if (typeof this.config.caching === 'object') {
        Properties.CachingConfig = {
          CachingKeys: this.config.caching.keys,
          Ttl: this.config.caching.ttl || this.config.caching.ttl || 3600,
        };
      }
    }

    if (this.config.sync) {
      const asyncConfig = new SyncConfig(this.api, this.config);
      Properties.SyncConfig = asyncConfig.compile();
    }

    if (this.config.kind === 'PIPELINE') {
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
              this.api.naming.getPipelineFunctionLogicalId(name);
            return { 'Fn::GetAtt': [logicalIdDataSource, 'FunctionId'] };
          }),
        },
      };
    } else {
      const { dataSource } = this.config;
      if (!this.api.hasDataSource(dataSource)) {
        throw new this.api.plugin.serverless.classes.Error(
          `Resolver '${this.config.type}.${this.config.field}' references unknown DataSource '${dataSource}'`,
        );
      }

      const logicalIdDataSource =
        this.api.naming.getDataSourceLogicalId(dataSource);
      Properties = {
        ...Properties,
        Kind: 'UNIT',
        DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
        MaxBatchSize: this.config.maxBatchSize,
      };
    }

    const logicalIdResolver = this.api.naming.getResolverLogicalId(
      this.config.type,
      this.config.field,
    );
    const logicalIdGraphQLSchema = this.api.naming.getSchemaLogicalId();

    return {
      [logicalIdResolver]: {
        Type: 'AWS::AppSync::Resolver',
        DependsOn: [logicalIdGraphQLSchema],
        Properties,
      },
    };
  }

  resolveMappingTemplate(
    type: 'request' | 'response',
  ): string | IntrinsicFunction | undefined {
    const templateName =
      type in this.config
        ? this.config[type]
        : this.api.config.defaultMappingTemplates?.[type];

    if (templateName !== false) {
      const templatePath = path.join(
        this.api.plugin.serverless.config.servicePath,
        this.api.config.mappingTemplatesLocation.resolvers,
        templateName || `${this.config.type}.${this.config.field}.${type}.vtl`,
      );
      const template = new MappingTemplate(this.api, {
        path: templatePath,
        substitutions: this.config.substitutions,
      });

      return template.compile();
    }
  }
}

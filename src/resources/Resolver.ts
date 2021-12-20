import { has } from 'ramda';
import {
  CfnResolver,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation';
import { ResolverConfig } from '../types/plugin';
import { Api } from './Api';
import path from 'path';
import { MappingTemplate } from './MappingTemplate';

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

    if (this.config.sync === true) {
      // Use defaults
      Properties.SyncConfig = {
        ConflictDetection: 'VERSION',
      };
    } else if (typeof this.config.sync === 'object') {
      Properties.SyncConfig = {
        ConflictDetection: this.config.sync.conflictDetection,
        ConflictHandler: this.config.sync.conflictHandler,
        ...(this.config.sync.conflictHandler === 'LAMBDA'
          ? {
              LambdaConflictHandlerConfig: {
                LambdaConflictHandlerArn: this.api.getLambdaArn(
                  this.config.sync,
                ),
              },
            }
          : {}),
      };
    }

    if (this.config.kind === 'PIPELINE') {
      Properties = {
        ...Properties,
        Kind: 'PIPELINE',
        PipelineConfig: {
          Functions: this.config.functions.map((functionAttributeName) => {
            const logicalIdDataSource =
              this.api.naming.getPipelineFunctionLogicalId(
                functionAttributeName,
              );
            return { 'Fn::GetAtt': [logicalIdDataSource, 'FunctionId'] };
          }),
        },
      };
    } else {
      Properties = {
        ...Properties,
        Kind: 'UNIT',
        DataSourceName: this.config.dataSource,
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
    const templateName = has(type)(this.config)
      ? this.config[type]
      : this.api.config.defaultMappingTemplates?.[type];

    if (templateName !== false) {
      const templatePath = path.join(
        this.api.config.mappingTemplatesLocation,
        templateName || `${this.config.type}.${this.config.field}.${type}.vtl`,
      );
      const template = new MappingTemplate({
        path: templatePath,
        substitutions: {
          ...this.api.config.substitutions,
          ...this.config.substitutions,
        },
      });

      return template.compile();
    }
  }
}

import { has } from 'ramda';
import {
  CfnFunctionResolver,
  CfnResources,
  IntrinsictFunction,
} from 'types/cloudFormation';
import { FunctionConfig } from 'types/plugin';
import { Api } from './Api';
import path from 'path';
import { MappingTemplate } from './MappingTemplate';

export class PipelineFunction {
  constructor(private api: Api, private config: FunctionConfig) {}

  compile(): CfnResources {
    const logicalId = this.api.naming.getPipelineFunctionLogicalId(
      this.config.name,
    );
    const logicalIdDataSource = this.api.naming.getDataSourceLogicalId(
      this.config.dataSource,
    );

    const Properties: CfnFunctionResolver['Properties'] = {
      ApiId: this.api.getApiId(),
      Name: this.config.name,
      DataSourceName: { 'Fn::GetAtt': [logicalIdDataSource, 'Name'] },
      Description: this.config.description,
      FunctionVersion: '2018-05-29',
    };

    const requestMappingTemplates = this.resolveMappingTemplate('request');
    if (requestMappingTemplates) {
      Properties.RequestMappingTemplate = requestMappingTemplates;
    }

    const responseMappingTemplate = this.resolveMappingTemplate('response');
    if (responseMappingTemplate) {
      Properties.ResponseMappingTemplate = responseMappingTemplate;
    }

    return {
      [logicalId]: {
        Type: 'AWS::AppSync::FunctionConfiguration',
        Properties,
      },
    };
  }

  resolveMappingTemplate(
    type: 'request' | 'response',
  ): string | IntrinsictFunction | undefined {
    const templateName = has(type)(this.config)
      ? this.config[type]
      : this.api.config.defaultMappingTemplates?.[type];

    if (templateName !== false) {
      const templatePath = path.join(
        this.api.config.functionConfigurationsLocation,
        templateName || `${this.config.name}.${type}.vtl`,
      );
      const template = new MappingTemplate({
        path: templatePath,
        substitutions: {
          ...this.api.config.substitutions,
          ...this.api.config.substitutions,
        },
      });

      return template.compile();
    }
  }
}

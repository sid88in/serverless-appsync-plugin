import {
  CfnFunctionResolver,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation';
import { PipelineFunctionConfig } from '../types/plugin';
import { Api } from './Api';
import path from 'path';
import { MappingTemplate } from './MappingTemplate';
import { SyncConfig } from './SyncConfig';

export class PipelineFunction {
  constructor(private api: Api, private config: PipelineFunctionConfig) {}

  compile(): CfnResources {
    const { dataSource } = this.config;
    if (!this.api.hasDataSource(dataSource)) {
      throw new this.api.plugin.serverless.classes.Error(
        `Pipeline Function '${this.config.name}' references unknown DataSource '${dataSource}'`,
      );
    }

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
      MaxBatchSize: this.config.maxBatchSize,
    };

    const requestMappingTemplates = this.resolveMappingTemplate('request');
    if (requestMappingTemplates) {
      Properties.RequestMappingTemplate = requestMappingTemplates;
    }

    const responseMappingTemplate = this.resolveMappingTemplate('response');
    if (responseMappingTemplate) {
      Properties.ResponseMappingTemplate = responseMappingTemplate;
    }

    if (this.config.sync) {
      const asyncConfig = new SyncConfig(this.api, this.config);
      Properties.SyncConfig = asyncConfig.compile();
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
  ): string | IntrinsicFunction | undefined {
    const templateName =
      type in this.config
        ? this.config[type]
        : this.api.config.defaultMappingTemplates?.[type];

    if (templateName !== false) {
      const templatePath = path.join(
        this.api.plugin.serverless.config.servicePath,
        this.api.config.mappingTemplatesLocation.pipelineFunctions,
        templateName || `${this.config.name}.${type}.vtl`,
      );
      const template = new MappingTemplate(this.api, {
        path: templatePath,
        substitutions: this.config.substitutions,
      });

      return template.compile();
    }
  }
}

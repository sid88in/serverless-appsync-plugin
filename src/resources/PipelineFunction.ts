import {
  CfnFunctionResolver,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation.js';
import { isSharedApiConfig, PipelineFunctionConfig } from '../types/plugin.js';
import { Api } from './Api.js';
import path from 'path';
import { MappingTemplate } from './MappingTemplate.js';
import { SyncConfig } from './SyncConfig.js';
import { JsResolver } from './JsResolver.js';
import { Naming } from './Naming.js';

export class PipelineFunction {
  constructor(private api: Api, private config: PipelineFunctionConfig) {}

  compile(): CfnResources {
    const { dataSource, code } = this.config;
    if (
      !isSharedApiConfig(this.api.config) &&
      !this.api.hasDataSource(dataSource)
    ) {
      throw new this.api.plugin.serverless.classes.Error(
        `Pipeline Function '${this.config.name}' references unknown DataSource '${dataSource}'`,
      );
    }

    const logicalId = Naming.getPipelineFunctionLogicalId(this.config.name);
    const logicalIdDataSource = Naming.getDataSourceLogicalId(dataSource);

    const dataSourceName =
      isSharedApiConfig(this.api.config) && !this.api.hasDataSource(dataSource)
        ? dataSource
        : ({
            'Fn::GetAtt': [logicalIdDataSource, 'Name'],
          } satisfies IntrinsicFunction);

    const Properties: CfnFunctionResolver['Properties'] = {
      ApiId: this.api.getApiId(),
      Name: this.config.name,
      DataSourceName: dataSourceName,
      Description: this.config.description,
      FunctionVersion: '2018-05-29',
      MaxBatchSize: this.config.maxBatchSize,
    };

    if (code) {
      Properties.Code = this.resolveJsCode(code);
      Properties.Runtime = {
        Name: 'APPSYNC_JS',
        RuntimeVersion: '1.0.0',
      };
    } else {
      const requestMappingTemplates = this.resolveMappingTemplate('request');
      if (requestMappingTemplates) {
        Properties.RequestMappingTemplate = requestMappingTemplates;
      }

      const responseMappingTemplate = this.resolveMappingTemplate('response');
      if (responseMappingTemplate) {
        Properties.ResponseMappingTemplate = responseMappingTemplate;
      }
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

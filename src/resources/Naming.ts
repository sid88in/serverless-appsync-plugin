import { upperFirst } from 'lodash';
import { DataSourceConfig, ResolverConfig } from '../types/plugin';

export class Naming {
  constructor(private apiName: string, private isSingleApi: boolean) {}

  getCfnName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  getLogicalId(name: string): string {
    if (this.isSingleApi) {
      return this.getCfnName(name);
    }

    return this.getCfnName(`${upperFirst(this.apiName)}${name}`);
  }

  getApiLogicalId() {
    return this.getLogicalId(`GraphQlApi`);
  }

  getSchemaLogicalId() {
    return this.getLogicalId(`GraphQlSchema`);
  }

  getLogGroupLogicalId() {
    return this.getLogicalId(`GraphQlApiLogGroup`);
  }

  getLogGroupRoleLogicalId() {
    return this.getLogicalId(`GraphQlApiLogGroupRole`);
  }

  getLogGroupPolicyLogicalId() {
    return this.getLogicalId(`GraphQlApiLogGroupPolicy`);
  }

  getCachingLogicalId() {
    return this.getLogicalId(`GraphQlCaching`);
  }

  getLambdaAuthLogicalId() {
    return this.getLogicalId(`LambdaAuthorizerPermission`);
  }

  getApiKeyLogicalId(name: string) {
    return this.getLogicalId(`GraphQlApi${name}`);
  }

  // Warning: breaking change.
  // api name added
  getDataSourceLogicalId(name: string) {
    return `GraphQlDs${this.getLogicalId(name)}`;
  }

  getDataSourceRoleLogicalId(name: string) {
    return this.getDataSourceLogicalId(`${name}Role`);
  }

  getResolverLogicalId(type: string, field: string) {
    return this.getLogicalId(`GraphQlResolver${type}${field}`);
  }

  getPipelineFunctionLogicalId(name: string) {
    return this.getLogicalId(`GraphQlFunctionConfiguration${name}`);
  }

  getWafLogicalId() {
    return this.getLogicalId('GraphQlWaf');
  }

  getWafAssociationLogicalId() {
    return this.getLogicalId('GraphQlWafAssoc');
  }

  getDataSourceEmbeddedLambdaResolverName(config: DataSourceConfig) {
    return config.name;
  }

  getResolverEmbeddedSyncLambdaName(config: ResolverConfig) {
    return `${config.type}_${config.field}_Sync`;
  }

  getAuthenticationEmbeddedLamdbaName() {
    return `${this.apiName}Authorizer`;
  }
}

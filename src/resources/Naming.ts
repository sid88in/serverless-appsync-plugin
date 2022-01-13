import { DataSourceConfig, ResolverConfig } from '../types/plugin';

export class Naming {
  constructor(private apiName: string) {}

  getCfnName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  getLogicalId(name: string): string {
    return this.getCfnName(name);
  }

  getApiLogicalId() {
    return this.getLogicalId(`GraphQlApi`);
  }

  getSchemaLogicalId() {
    return this.getLogicalId(`GraphQlSchema`);
  }

  getDomainNameLogicalId() {
    return this.getLogicalId(`GraphQlDomainName`);
  }

  getDomainAssociationLogicalId() {
    return this.getLogicalId(`GraphQlDomainAssociation`);
  }

  getDomainReoute53RecordLogicalId() {
    return this.getLogicalId(`GraphQlDomainRoute53Record`);
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

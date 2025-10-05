import {
  AppSyncConfig,
  DataSourceConfig,
  PipelineFunctionConfig,
  ResolverConfig,
} from '../types/plugin';

export class Naming {
  constructor(private config: AppSyncConfig) {}

  getCfnName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  getLogicalId(name: string): string {
    const logicalIdPrefix = this.config.logicalIdPrefix || '';
    return this.getCfnName(`${logicalIdPrefix}${name}`);
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

  getDomainCertificateLogicalId() {
    return this.getLogicalId(`GraphQlDomainCertificate`);
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
    return this.getLogicalId(`GraphQlDs${name}`);
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

  getResolverEmbeddedSyncLambdaName(
    config: ResolverConfig | PipelineFunctionConfig,
  ) {
    if ('name' in config) {
      return `${config.name}_Sync`;
    } else {
      return `${config.type}_${config.field}_Sync`;
    }
  }

  getAuthenticationEmbeddedLamdbaName() {
    return `${this.config.name}Authorizer`;
  }
}

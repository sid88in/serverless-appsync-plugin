import {
  DataSourceConfig,
  PipelineFunctionConfig,
  ResolverConfig,
} from '../types/plugin';

export class Naming {
  constructor(private apiName: string) {}

  static getCfnName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  static getLogicalId(name: string): string {
    return Naming.getCfnName(name);
  }

  getApiLogicalId() {
    return Naming.getLogicalId(`GraphQlApi`);
  }

  getSchemaLogicalId() {
    return Naming.getLogicalId(`GraphQlSchema`);
  }

  getDomainNameLogicalId() {
    return Naming.getLogicalId(`GraphQlDomainName`);
  }

  getDomainCertificateLogicalId() {
    return Naming.getLogicalId(`GraphQlDomainCertificate`);
  }

  getDomainAssociationLogicalId() {
    return Naming.getLogicalId(`GraphQlDomainAssociation`);
  }

  getDomainReoute53RecordLogicalId() {
    return Naming.getLogicalId(`GraphQlDomainRoute53Record`);
  }

  getLogGroupLogicalId() {
    return Naming.getLogicalId(`GraphQlApiLogGroup`);
  }

  getLogGroupRoleLogicalId() {
    return Naming.getLogicalId(`GraphQlApiLogGroupRole`);
  }

  getLogGroupPolicyLogicalId() {
    return Naming.getLogicalId(`GraphQlApiLogGroupPolicy`);
  }

  getCachingLogicalId() {
    return Naming.getLogicalId(`GraphQlCaching`);
  }

  getLambdaAuthLogicalId() {
    return Naming.getLogicalId(`LambdaAuthorizerPermission`);
  }

  getApiKeyLogicalId(name: string) {
    return Naming.getLogicalId(`GraphQlApi${name}`);
  }

  static getDataSourceLogicalId(name: string) {
    return `GraphQlDs${Naming.getLogicalId(name)}`;
  }

  static getDataSourceRoleLogicalId(name: string) {
    return Naming.getDataSourceLogicalId(`${name}Role`);
  }

  static getResolverLogicalId(type: string, field: string) {
    return Naming.getLogicalId(`GraphQlResolver${type}${field}`);
  }

  static getPipelineFunctionLogicalId(name: string) {
    return Naming.getLogicalId(`GraphQlFunctionConfiguration${name}`);
  }

  getWafLogicalId() {
    return Naming.getLogicalId('GraphQlWaf');
  }

  getWafAssociationLogicalId() {
    return Naming.getLogicalId('GraphQlWafAssoc');
  }

  static getDataSourceEmbeddedLambdaResolverName(config: DataSourceConfig) {
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
    return `${this.apiName}Authorizer`;
  }
}

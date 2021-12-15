import {
  CfnWafAction,
  CfnWafRuleStatement,
  IntrinsictFunction,
} from './cloudFormation';

export type AppSyncConfig = {
  apiId?: string;
  isSingleConfig?: boolean;
  name: string;
  region: string;
  schema: string;
  apiKeys?: ApiKeyConfig[];
  caching?: {
    behavior: 'FULL_REQUEST_CACHING' | 'PER_RESOLVER_CACHING';
    type?: string;
    ttl?: number;
    atRestEncryption?: boolean;
    transitEncryption?: boolean;
  };
  additionalAuthenticationProviders: Auth[];
  logConfig?: {
    loggingRoleArn?: string | IntrinsictFunction;
    level?: 'ERROR' | 'NONE' | 'ALL';
    logRetentionInDays?: number;
    excludeVerboseContent?: boolean;
  };
  defaultMappingTemplates?: {
    request?: string | false;
    response?: string | false;
  };
  mappingTemplatesLocation: string;
  functionConfigurationsLocation: string;
  mappingTemplates: ResolverConfig[];
  functionConfigurations: FunctionConfig[];
  dataSources: DataSourceConfig[];
  substitutions: Record<string, string | IntrinsictFunction>;
  xrayEnabled: boolean;
  wafConfig?: WafConfig;
  tags?: Record<string, string>;
} & Auth;

export type IamStatement = {
  Effect: 'Allow' | 'Deny';
  Action: string[];
  Resource: (string | IntrinsictFunction) | (string | IntrinsictFunction)[];
};

export type WafThrottleConfig =
  | number
  | {
      name?: string;
      action?: WafAction;
      aggregateKeyType?: 'IP' | 'FORWARDED_IP';
      limit?: number;
      priority?: number;
      forwardedIPConfig?: {
        headerName: string;
        fallbackBehavior: string;
      };
      scopeDownStatement?: CfnWafRuleStatement;
    };

export type WafDisableIntrospectionConfig = {
  name?: string;
  priority?: number;
};

export type WafActionKeys = 'Allow' | 'Block';
export type WafAction = WafActionKeys | CfnWafAction;

export type WafRuleThrottle = {
  throttle: WafThrottleConfig;
};

export type WafRuleCustom = {
  name: string;
  priority?: number;
  action?: WafAction;
  overrideAction?: WafAction;
  statement: CfnWafRuleStatement;
  visibilityConfig?: VisibilityConfig;
};

export type WafRuleDisableIntrospection = {
  disableIntrospection: WafDisableIntrospectionConfig;
};

export type WafRule =
  | WafRuleThrottle
  | WafRuleDisableIntrospection
  | WafRuleCustom
  | 'disableIntrospection'
  | 'throttle';

export type ApiKeyConfigObject = {
  apiKeyId?: string;
  name: string;
  description?: string;
  expiresAfter?: string;
  expiresAt?: string;
  wafRules?: WafRule[];
};

export type ApiKeyConfig = ApiKeyConfigObject | string;

export type CognitoAuth = {
  authenticationType: 'AMAZON_COGNITO_USER_POOLS';
  userPoolConfig: {
    userPoolId: string | IntrinsictFunction;
    awsRegion?: string | IntrinsictFunction;
    defaultAction?: 'ALLOW' | 'DENY';
    appIdClientRegex?: string;
  };
};

export type IamAuth = {
  authenticationType: 'AWS_IAM';
};

export type LambdaAuth = {
  authenticationType: 'AWS_LAMBDA';
  lambdaAuthorizerConfig: LambdaConfig & {
    identityValidationExpression?: string;
    authorizerResultTtlInSeconds?: number;
  };
};

export type OidcAuth = {
  authenticationType: 'OPENID_CONNECT';
  openIdConnectConfig: {
    issuer: string;
    clientId: string;
    iatTTL?: number;
    authTTL?: number;
  };
};

export type ApiKeyAuth = {
  authenticationType: 'API_KEY';
};

export type Auth = CognitoAuth | LambdaAuth | OidcAuth | ApiKeyAuth | IamAuth;

export type ResolverConfig = {
  field: string;
  type: string;
  request?: string | false;
  response?: string | false;
  caching?:
    | {
        ttl?: number;
        keys?: string[];
      }
    | boolean;
  sync?:
    | {
        conflictDetection: 'VERSION';
        conflictHandler: 'OPTIMISTIC_CONCURRENCY' | 'LAMBDA';
        functionName?: string;
        lambdaFunctionArn: string | IntrinsictFunction;
      }
    | boolean;
  substitutions?: Record<string, string | IntrinsictFunction>;
} & (
  | {
      kind: 'UNIT';
      dataSource: string;
    }
  | {
      kind: 'PIPELINE';
      functions: string[];
    }
);

export type FunctionConfig = {
  name: string;
  dataSource: string;
  description?: string;
  request?: string | false;
  response?: string | false;
  substitutions?: Record<string, string | IntrinsictFunction>;
};

export type DsDynamoDBConfig = {
  type: 'AMAZON_DYNAMODB';
  config: {
    tableName: string | IntrinsictFunction;
    useCallerCredentials?: boolean;
    serviceRoleArn?: string | IntrinsictFunction;
    region?: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
    versioned?: boolean;
    deltaSyncConfig?: {
      deltaSyncTableName: string;
      baseTableTTL?: number;
      deltaSyncTableTTL?: number;
    };
  };
};

export type DsRelationalDbConfig = {
  type: 'RELATIONAL_DATABASE';
  config: {
    region?: string;
    relationalDatabaseSourceType?: 'RDS_HTTP_ENDPOINT';
    serviceRoleArn?: string | IntrinsictFunction;
    dbClusterIdentifier: string | IntrinsictFunction;
    databaseName?: string | IntrinsictFunction;
    schema?: string;
    awsSecretStoreArn: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
  };
};

export type DsElasticSearchConfig = {
  type: 'AMAZON_ELASTICSEARCH' | 'AMAZON_OPENSEARCH_SERVICE';
  config: {
    domain?: string;
    endpoint?: string | IntrinsictFunction;
    region?: string | IntrinsictFunction;
    serviceRoleArn?: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
  };
};

export type LambdaConfig =
  | {
      functionName: string;
      functionAlias?: string;
    }
  | {
      lambdaFunctionArn: string | IntrinsictFunction;
    };

export type DsLambdaConfig = {
  type: 'AWS_LAMBDA';
  config: {
    serviceRoleArn?: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
  } & LambdaConfig;
};

export type DsHttpConfig = {
  type: 'HTTP';
  config: {
    endpoint: string | IntrinsictFunction;
    serviceRoleArn?: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
    authorizationConfig?: {
      authorizationType: 'AWS_IAM';
      awsIamConfig: {
        signingRegion: string | IntrinsictFunction;
        signingServiceName?: string | IntrinsictFunction;
      };
    };
  };
};

export type DsNone = {
  type: 'NONE';
};

export type DataSourceConfig = {
  name: string;
  description?: string;
} & (
  | DsHttpConfig
  | DsDynamoDBConfig
  | DsRelationalDbConfig
  | DsElasticSearchConfig
  | DsLambdaConfig
  | DsNone
);

export type VisibilityConfig = {
  cloudWatchMetricsEnabled?: boolean;
  name?: string;
  sampledRequestsEnabled: boolean;
};

export type WafConfig = {
  enabled: boolean;
  name: string;
  defaultAction?: WafAction;
  description?: string;
  visibilityConfig?: VisibilityConfig;
  rules: WafRule[];
};

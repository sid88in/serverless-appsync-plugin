import {
  CfnWafAction,
  CfnWafRuleStatement,
  IntrinsicFunction,
} from './cloudFormation';

export type AppSyncConfig = {
  apiId?: string;
  isSingleConfig?: boolean;
  name: string;
  region: string;
  schema: string;
  authentication: Auth;
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
    loggingRoleArn?: string | IntrinsicFunction;
    level?: 'ERROR' | 'NONE' | 'ALL';
    logRetentionInDays?: number;
    excludeVerboseContent?: boolean;
  };
  defaultMappingTemplates?: {
    request?: string | false;
    response?: string | false;
  };
  mappingTemplatesLocation: {
    resolvers: string;
    pipelineFunctions: string;
  };
  resolvers: ResolverConfig[];
  pipelineFunctions: FunctionConfig[];
  dataSources: DataSourceConfig[];
  substitutions: Record<string, string | IntrinsicFunction>;
  xrayEnabled: boolean;
  wafConfig?: WafConfig;
  tags?: Record<string, string>;
};

export type IamStatement = {
  Effect: 'Allow' | 'Deny';
  Action: string[];
  Resource: (string | IntrinsicFunction)[];
};

export type WafThrottleConfig =
  | number
  | {
      name?: string;
      action?: WafActionKeys;
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
  action?: WafActionKeys;
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
  type: 'AMAZON_COGNITO_USER_POOLS';
  config: {
    userPoolId: string | IntrinsicFunction;
    awsRegion?: string | IntrinsicFunction;
    defaultAction?: 'ALLOW' | 'DENY';
    appIdClientRegex?: string;
  };
};

export type IamAuth = {
  type: 'AWS_IAM';
};

export type LambdaAuth = {
  type: 'AWS_LAMBDA';
  config: LambdaConfig & {
    identityValidationExpression?: string;
    authorizerResultTtlInSeconds?: number;
  };
};

export type OidcAuth = {
  type: 'OPENID_CONNECT';
  config: {
    issuer: string;
    clientId: string;
    iatTTL?: number;
    authTTL?: number;
  };
};

export type ApiKeyAuth = {
  type: 'API_KEY';
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
    | ({
        conflictDetection: 'VERSION';
        conflictHandler: 'OPTIMISTIC_CONCURRENCY' | 'LAMBDA';
      } & LambdaConfig)
    | boolean;
  substitutions?: Substitutions;
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

export type Substitutions = Record<string, string | IntrinsicFunction>;

export type FunctionConfig = {
  name: string;
  dataSource: string;
  description?: string;
  request?: string | false;
  response?: string | false;
  substitutions?: Substitutions;
};

export type DsDynamoDBConfig = {
  type: 'AMAZON_DYNAMODB';
  config: {
    tableName: string | IntrinsicFunction;
    useCallerCredentials?: boolean;
    serviceRoleArn?: string | IntrinsicFunction;
    region?: string | IntrinsicFunction;
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
    serviceRoleArn?: string | IntrinsicFunction;
    dbClusterIdentifier: string | IntrinsicFunction;
    databaseName?: string | IntrinsicFunction;
    schema?: string;
    awsSecretStoreArn: string | IntrinsicFunction;
    iamRoleStatements?: IamStatement[];
  };
};

export type DsElasticSearchConfig = {
  type: 'AMAZON_ELASTICSEARCH' | 'AMAZON_OPENSEARCH_SERVICE';
  config: {
    domain?: string;
    endpoint?: string | IntrinsicFunction;
    region?: string | IntrinsicFunction;
    serviceRoleArn?: string | IntrinsicFunction;
    iamRoleStatements?: IamStatement[];
  };
};

export type LambdaConfig =
  | {
      functionName: string;
      functionAlias?: string;
    }
  | {
      functionArn: string | IntrinsicFunction;
    };

export type DsLambdaConfig = {
  type: 'AWS_LAMBDA';
  config: {
    serviceRoleArn?: string | IntrinsicFunction;
    iamRoleStatements?: IamStatement[];
  } & LambdaConfig;
};

export type DsHttpConfig = {
  type: 'HTTP';
  config: {
    endpoint: string | IntrinsicFunction;
    serviceRoleArn?: string | IntrinsicFunction;
    iamRoleStatements?: IamStatement[];
    authorizationConfig?: {
      authorizationType: 'AWS_IAM';
      awsIamConfig: {
        signingRegion: string | IntrinsicFunction;
        signingServiceName?: string | IntrinsicFunction;
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
  name?: string;
  cloudWatchMetricsEnabled?: boolean;
  sampledRequestsEnabled?: boolean;
};

export type WafConfig = {
  enabled?: boolean;
  name: string;
  defaultAction?: WafActionKeys;
  description?: string;
  visibilityConfig?: VisibilityConfig;
  rules: WafRule[];
};

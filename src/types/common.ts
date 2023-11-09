import { CfnWafRuleStatement, IntrinsicFunction } from './cloudFormation';

export type IamStatement = {
  Effect: 'Allow' | 'Deny';
  Action: string[];
  Resource: string | IntrinsicFunction | (string | IntrinsicFunction)[];
};

export type WafConfig = {
  enabled?: boolean;
  arn?: string;
  name?: string;
  defaultAction?: WafAction;
  description?: string;
  visibilityConfig?: VisibilityConfig;
  rules?: WafRule[];
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
        fallbackBehavior: 'MATCH' | 'NO_MATCH';
      };
      scopeDownStatement?: CfnWafRuleStatement;
      visibilityConfig?: VisibilityConfig;
    };

export type WafDisableIntrospectionConfig = {
  name?: string;
  priority?: number;
  visibilityConfig?: VisibilityConfig;
};

export type WafAction = 'Allow' | 'Block';
export type WafRuleAction = 'Allow' | 'Block' | 'Count' | 'Captcha';

export type WafRuleThrottle = {
  throttle: WafThrottleConfig;
};

export type WafRuleCustom = {
  name: string;
  priority?: number;
  action?: WafRuleAction;
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

export type ApiKeyConfig = {
  apiKeyId?: string;
  name: string;
  description?: string;
  expiresAfter?: string | number;
  expiresAt?: string;
  wafRules?: WafRule[];
};

export type CognitoAuth = {
  type: 'AMAZON_COGNITO_USER_POOLS';
  config: {
    userPoolId: string | IntrinsicFunction;
    awsRegion?: string | IntrinsicFunction;
    defaultAction?: 'ALLOW' | 'DENY';
    appIdClientRegex?: string | IntrinsicFunction;
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

export type DomainConfig = {
  enabled?: boolean;
  useCloudFormation?: boolean;
  retain?: boolean;
  name: string;
  certificateArn?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
  route53?: boolean;
};

export type SyncConfig = {
  conflictDetection: 'VERSION' | 'NONE';
  conflictHandler: 'OPTIMISTIC_CONCURRENCY' | 'AUTOMERGE' | 'LAMBDA';
} & LambdaConfig;

export type Substitutions = Record<string, string | IntrinsicFunction>;

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

export type DsEventBridgeConfig = {
  type: 'AMAZON_EVENTBRIDGE';
  config: {
    serviceRoleArn?: string | IntrinsicFunction;
    iamRoleStatements?: IamStatement[];
    eventBusArn: string | IntrinsicFunction;
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

export type DsOpenSearchConfig = {
  type: 'AMAZON_OPENSEARCH_SERVICE';
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
    }
  | {
      function: Record<string, unknown>;
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

export type VisibilityConfig = {
  name?: string;
  cloudWatchMetricsEnabled?: boolean;
  sampledRequestsEnabled?: boolean;
};

export type LoggingConfig = {
  level: 'ERROR' | 'NONE' | 'ALL';
  enabled?: boolean;
  excludeVerboseContent?: boolean;
  retentionInDays?: number;
  roleArn?: string | IntrinsicFunction;
};

export type CachingConfig = {
  enabled?: boolean;
  behavior: 'FULL_REQUEST_CACHING' | 'PER_RESOLVER_CACHING';
  type?: string;
  ttl?: number;
  atRestEncryption?: boolean;
  transitEncryption?: boolean;
};

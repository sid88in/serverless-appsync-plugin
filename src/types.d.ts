type IamStatement = {
  Effect: 'Allow' | 'Deny';
  Action: string[];
  Resource: (string | IntrinsictFunction) | (string | IntrinsictFunction)[];
};

export type WafThrottleConfig =
  | number
  | {
      action?: WafAction;
      aggregateKeyType?: 'IP' | 'FORWARDED_IP';
      limit?: number;
      priority?: number;
      forwardedIPConfig?: {
        headerName: string;
        fallbackBehavior: string;
      };
    };

export type WafDisableIntrospectionConfig = {
  priority?: number;
};

type WafActionKeys = 'Allow' | 'Block';
type WafAction = WafActionKeys | CfnWafAction;

type WafRuleThrottle = {
  throttle: WafThrottleConfig;
};

type WafRuleCustom = {
  name: string;
  priority?: number;
  action?: WafAction;
  overrideAction?: WafAction;
  statement: CfnWafRuleStatement;
  visibilityConfig: Record<string, unknown>;
};

type WafRuleDisableIntrospection = {
  disableIntrospection: WafDisableIntrospectionConfig;
};

type WafRule =
  | WafRuleThrottle
  | WafRuleDisableIntrospection
  | WafRuleCustom
  | 'disableIntrospection'
  | 'throttle';

type ApiKeyConfig = {
  apiKeyId?: string;
  name?: string;
  description?: string;
  expiresAfter?: string;
  expiresAt?: string;
  wafRules?: WafRule[];
};

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

export type Resolver = {
  field: string;
  type: string;
  request?: string | false;
  response?: string | false;
  caching:
    | {
        ttl: number;
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
  datasource: string;
  request: string | false;
  response: string | false;
  substitutions?: Record<string, string | IntrinsictFunction>;
};

type DsDynamoDBConfig = {
  type: 'AMAZON_DYNAMODB';
  config: {
    tableName: string | IntrinsictFunction;
    useCallerCredentials?: boolean;
    serviceRoleArn?: string | IntrinsictFunction;
    region: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
    versioned?: boolean;
    deltaSyncConfig?: {
      deltaSyncTableName: string;
      baseTableTTL?: number;
      deltaSyncTableTTL?: number;
    };
  };
};

type DsRelationalDbConfig = {
  type: 'RELATIONAL_DATABASE';
  config: {
    region: string;
    relationalDatabaseSourceType?: 'RDS_HTTP_ENDPOINT';
    serviceRoleArn?: string | IntrinsictFunction;
    dbClusterIdentifier: string | IntrinsictFunction;
    databaseName: string | IntrinsictFunction;
    schema: string;
    awsSecretStoreArn: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
  };
};

type DsElasticSearchConfig = {
  type: 'AMAZON_ELASTICSEARCH';
  config: {
    domain: string;
    region: string | IntrinsictFunction;
    serviceRoleArn?: string | IntrinsictFunction;
    endpoint: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
  };
};

type LambdaConfig =
  | {
      functionName: string;
      functionAlias?: string;
    }
  | {
      lambdaFunctionArn: string | IntrinsictFunction;
    };

type DsLambdaConfig = {
  type: 'AWS_LAMBDA';
  config: {
    serviceRoleArn?: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
  } & LambdaConfig;
};

type DsHttpConfig = {
  type: 'HTTP';
  config: {
    endpoint: string | IntrinsictFunction;
    serviceRoleArn?: string | IntrinsictFunction;
    iamRoleStatements?: IamStatement[];
    authorizationConfig?: {
      authorizationType?: 'AWS_IAM';
      awsIamConfig?: {
        signingRegion: string | IntrinsictFunction;
        signingServiceName?: string | IntrinsictFunction;
      };
    };
  };
};

type DsNone = {
  type: 'NONE';
};

export type DataSource = {
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

export type WafConfig = {
  enabled: boolean;
  name: string;
  defaultAction?: WafAction;
  description?: string;
  visibilityConfig?: Record<string, unknown>;
  rules: WafRule[];
};

export type AppSyncConfig = {
  apiId?: string;
  isSingleConfig?: boolean;
  name: string;
  region: string;
  schema: string;
  apiKeys?: ApiKeyConfig[];
  allowHashDescription?: boolean;
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
    excludeVerboseContent?: boolean;
  };
  defaultMappingTemplates?: {
    request?: string | false;
    response?: string | false;
  };
  mappingTemplatesLocation: string;
  functionConfigurationsLocation: string;
  mappingTemplates: Resolver[];
  functionConfigurations: FunctionConfig[];
  dataSources: DataSource[];
  substitutions: Record<string, string | IntrinsictFunction>;
  xrayEnabled: boolean;
  wafConfig?: WafConfig;
  tags?: Record<string, string>;
} & Auth;

export type FnGetAtt = {
  'Fn::GetAtt': string[];
};

export type FnJoin = {
  'Fn::Join': [string, (string | IntrinsictFunction)[]];
};

export type FnRef = {
  Ref: string;
};

export type FnSub = {
  'Fn::Sub': [string, Record<string, string | IntrinsictFunction>];
};

export type IntrinsictFunction = FnGetAtt | FnJoin | FnRef | FnSub;

export type DeltaSyncConfig = {
  BaseTableTTL: number;
  DeltaSyncTableName: string | IntrinsictFunction;
  DeltaSyncTableTTL: number;
};

export type CfnDataSource = {
  Type: 'AWS::AppSync::DataSource';
  Properties: {
    ApiId: string | IntrinsictFunction;
    Name: string | IntrinsictFunction;
    Description?: string;
    Type?:
      | 'AWS_LAMBDA'
      | 'AMAZON_DYNAMODB'
      | 'AMAZON_ELASTICSEARCH'
      | 'AMAZON_OPENSEARCH_SERVICE'
      | 'NONE'
      | 'HTTP'
      | 'RELATIONAL_DATABASE';
    ServiceRoleArn?: string | IntrinsictFunction;
    LambdaConfig?: {
      LambdaFunctionArn: string | IntrinsictFunction;
    };
    DynamoDBConfig?: {
      Versioned: boolean;
      TableName: string | IntrinsictFunction;
      AwsRegion: string | IntrinsictFunction;
      UseCallerCredentials: boolean;
      DeltaSyncConfig?: DeltaSyncConfig;
    };
    ElasticsearchConfig?: {
      AwsRegion: string | IntrinsictFunction;
      Endpoint: string | IntrinsictFunction;
    };
    RelationalDatabaseConfig?: {
      RelationalDatabaseSourceType: 'RDS_HTTP_ENDPOINT' | IntrinsictFunction;
      RdsHttpEndpointConfig?: {
        AwsRegion: string | IntrinsictFunction;
        DbClusterIdentifier: string | IntrinsictFunction;
        DatabaseName: string | IntrinsictFunction;
        Schema: string | IntrinsictFunction;
        AwsSecretStoreArn: string | IntrinsictFunction;
      };
    };
    HttpConfig?: {
      Endpoint: string | IntrinsictFunction;
      AuthorizationConfig?: {
        AuthorizationType?: string;
        AwsIamConfig?: {
          SigningRegion: string | IntrinsictFunction;
          SigningServiceName?: string | IntrinsictFunction;
        };
      };
    };
  };
};

export type CfnResolver = {
  RequestMappingTemplate?: string;
  ResponseMappingTemplate?: string;
  Properties: {
    ApiId: string | IntrinsictFunction;
    TypeName: string;
    FieldName: string;
    Kind?: 'PIPELINE' | 'UNIT';
    DataSourceName?: string | IntrinsictFunction;
    Description?: string;
    FunctionVersion?: string;
    RequestMappingTemplate?: string | IntrinsictFunction;
    ResponseMappingTemplate?: string | IntrinsictFunction;
    PipelineConfig?: {
      Functions: (string | IntrinsictFunction)[];
    };
    CachingConfig?: {
      Ttl: number;
      CachingKeys?: string[];
    };
    SyncConfig?: {
      ConflictDetection: 'VERSION';
      ConflictHandler?: 'OPTIMISTIC_CONCURRENCY' | 'LAMBDA';
      LambdaConflictHandlerConfig?: {
        LambdaConflictHandlerArn: string | IntrinsictFunction;
      };
    };
  };
};

export type CfnFunctionResolver = {
  Type: 'AWS::AppSync::FunctionConfiguration';
  Properties: {
    ApiId: string | IntrinsictFunction;
    Name: string | IntrinsictFunction;
    DataSourceName: string | IntrinsictFunction;
    Description?: string;
    FunctionVersion?: string;
    RequestMappingTemplate?: string | IntrinsictFunction;
    ResponseMappingTemplate?: string | IntrinsictFunction;
  };
};

export type CfnApiKey = {
  Type: 'AWS::AppSync::ApiKey';
  Properties: {
    ApiId: string | IntrinsictFunction;
    Description?: string;
    Expires: number;
    ApiKeyId?: string;
  };
};

type CfnWafAction = { ['Allow' | 'Action']: ?Record<string, never> };

type CfnWafRule = {
  Action?: CfnWafAction;
  Name: string;
  OverrideAction?: WafAction;
  Priority?: number;
  Statement: CfnWafRuleStatement;
  VisibilityConfig: unknown;
};

type CfnWafRuleStatement = {
  RateBasedStatement?: CfnWafRuleRateBasedStatement;
  ByteMatchStatement?: CfnWafRuleRateByteMatchStatement;
  AndStatement?: {
    Statements: CfnWafRuleStatement[];
  };
};

type CfnWafRuleRateBasedStatement = {
  AggregateKeyType: string;
  ForwardedIPConfig?: {
    FallbackBehavior: string;
    HeaderName: string;
  };
  Limit: number;
  ScopeDownStatement?: CfnWafRuleStatement;
};

type CfnWafRuleRateByteMatchStatement = {
  FieldToMatch: unknown;
  PositionalConstraint: string;
  SearchString?: string | IntrinsictFunction;
  SearchStringBase64?: string;
  TextTransformations: {
    Priority: number;
    Type: string;
  }[];
};

export type CfnOutput = {
  OutputKey: string;
  OutputValue: string;
};

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

export type CfnDeltaSyncConfig = {
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
      DeltaSyncConfig?: CfnDeltaSyncConfig;
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

export type CfnWafAction = { [key: string]: Record<string, never> };

export type CfnWafRule = {
  Action?: CfnWafAction;
  Name: string;
  OverrideAction?: CfnWafAction;
  Priority?: number;
  Statement: CfnWafRuleStatement;
  VisibilityConfig: unknown;
};

export type CfnWafRuleStatement = {
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

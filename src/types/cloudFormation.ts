import { AWS } from '@serverless/typescript';

export type FnGetAtt = {
  'Fn::GetAtt': string[];
};

export type FnJoin = {
  'Fn::Join': [string, (string | IntrinsicFunction)[]];
};

export type FnRef = {
  Ref: string;
};

export type FnSub = {
  'Fn::Sub': [string, Record<string, string | IntrinsicFunction>];
};

export type IntrinsicFunction = FnGetAtt | FnJoin | FnRef | FnSub;

export type CfnDeltaSyncConfig = {
  BaseTableTTL: number;
  DeltaSyncTableName: string | IntrinsicFunction;
  DeltaSyncTableTTL: number;
};

export type CfnResources = Required<Required<AWS>['resources']>['Resources'];
export type CfnResource = CfnResources[string];

export type CfnDataSource = {
  Type: 'AWS::AppSync::DataSource';
  Properties: {
    ApiId: string | IntrinsicFunction;
    Name: string | IntrinsicFunction;
    Description?: string;
    Type?:
      | 'AWS_LAMBDA'
      | 'AMAZON_DYNAMODB'
      | 'AMAZON_ELASTICSEARCH'
      | 'AMAZON_OPENSEARCH_SERVICE'
      | 'NONE'
      | 'HTTP'
      | 'RELATIONAL_DATABASE';
    ServiceRoleArn?: string | IntrinsicFunction;
    LambdaConfig?: {
      LambdaFunctionArn: string | IntrinsicFunction;
    };
    DynamoDBConfig?: {
      TableName: string | IntrinsicFunction;
      AwsRegion: string | IntrinsicFunction;
      UseCallerCredentials: boolean;
      Versioned?: boolean;
      DeltaSyncConfig?: CfnDeltaSyncConfig;
    };
    ElasticsearchConfig?: {
      AwsRegion: string | IntrinsicFunction;
      Endpoint: string | IntrinsicFunction;
    };
    RelationalDatabaseConfig?: {
      RelationalDatabaseSourceType: 'RDS_HTTP_ENDPOINT' | IntrinsicFunction;
      RdsHttpEndpointConfig?: {
        AwsRegion: string | IntrinsicFunction;
        DbClusterIdentifier: string | IntrinsicFunction;
        DatabaseName?: string | IntrinsicFunction;
        Schema?: string | IntrinsicFunction;
        AwsSecretStoreArn: string | IntrinsicFunction;
      };
    };
    HttpConfig?: {
      Endpoint: string | IntrinsicFunction;
      AuthorizationConfig?: {
        AuthorizationType?: string;
        AwsIamConfig?: {
          SigningRegion: string | IntrinsicFunction;
          SigningServiceName?: string | IntrinsicFunction;
        };
      };
    };
  };
};

export type CfnResolver = {
  RequestMappingTemplate?: string;
  ResponseMappingTemplate?: string;
  Properties: {
    ApiId: string | IntrinsicFunction;
    TypeName: string;
    FieldName: string;
    Kind?: 'PIPELINE' | 'UNIT';
    DataSourceName?: string | IntrinsicFunction;
    Description?: string;
    FunctionVersion?: string;
    RequestMappingTemplate?: string | IntrinsicFunction;
    ResponseMappingTemplate?: string | IntrinsicFunction;
    PipelineConfig?: {
      Functions: (string | IntrinsicFunction)[];
    };
    CachingConfig?: {
      Ttl: number;
      CachingKeys?: string[];
    };
    SyncConfig?: {
      ConflictDetection: 'VERSION';
      ConflictHandler?: 'OPTIMISTIC_CONCURRENCY' | 'LAMBDA';
      LambdaConflictHandlerConfig?: {
        LambdaConflictHandlerArn: string | IntrinsicFunction;
      };
    };
  };
};

export type CfnFunctionResolver = {
  Type: 'AWS::AppSync::FunctionConfiguration';
  Properties: {
    ApiId: string | IntrinsicFunction;
    Name: string | IntrinsicFunction;
    DataSourceName: string | IntrinsicFunction;
    Description?: string;
    FunctionVersion?: string;
    RequestMappingTemplate?: string | IntrinsicFunction;
    ResponseMappingTemplate?: string | IntrinsicFunction;
  };
};

export type CfnApiKey = {
  Type: 'AWS::AppSync::ApiKey';
  Properties: {
    ApiId: string | IntrinsicFunction;
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
  [k: string]: Record<string, unknown> | undefined;
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
  SearchString?: string | IntrinsicFunction;
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

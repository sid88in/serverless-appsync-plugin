import { merge } from 'lodash-es';
import {
  CfnDataSource,
  CfnResources,
  IntrinsicFunction,
} from '../types/cloudFormation.js';
import {
  DataSourceConfig,
  DsDynamoDBConfig,
  DsOpenSearchConfig,
  DsHttpConfig,
  DsRelationalDbConfig,
  IamStatement,
  DsEventBridgeConfig,
} from '../types/plugin.js';
import { Api } from './Api.js';
import { Naming } from './Naming.js';

export class DataSource {
  constructor(private api: Api, private config: DataSourceConfig) {}

  compile(): CfnResources {
    const resource: CfnDataSource = {
      Type: 'AWS::AppSync::DataSource',
      Properties: {
        ApiId: this.api.getApiId(),
        Name: this.config.name,
        Description: this.config.description,
        Type: this.config.type,
      },
    };

    if (this.config.type === 'AWS_LAMBDA') {
      resource.Properties.LambdaConfig = {
        LambdaFunctionArn: this.api.getLambdaArn(
          this.config.config,
          Naming.getDataSourceEmbeddedLambdaResolverName(this.config),
        ),
      };
    } else if (this.config.type === 'AMAZON_DYNAMODB') {
      resource.Properties.DynamoDBConfig = this.getDynamoDbConfig(this.config);
    } else if (this.config.type === 'AMAZON_OPENSEARCH_SERVICE') {
      resource.Properties.OpenSearchServiceConfig = this.getOpenSearchConfig(
        this.config,
      );
    } else if (this.config.type === 'RELATIONAL_DATABASE') {
      resource.Properties.RelationalDatabaseConfig = this.getRelationalDbConfig(
        this.config,
      );
    } else if (this.config.type === 'HTTP') {
      resource.Properties.HttpConfig = this.getHttpConfig(this.config);
    } else if (this.config.type === 'AMAZON_EVENTBRIDGE') {
      resource.Properties.EventBridgeConfig = this.getEventBridgeConfig(
        this.config,
      );
    }

    const logicalId = Naming.getDataSourceLogicalId(this.config.name);

    const resources = {
      [logicalId]: resource,
    };

    if ('config' in this.config && this.config.config.serviceRoleArn) {
      resource.Properties.ServiceRoleArn = this.config.config.serviceRoleArn;
    } else {
      const role = this.compileDataSourceIamRole();
      if (role) {
        const roleLogicalId = Naming.getDataSourceRoleLogicalId(
          this.config.name,
        );
        resource.Properties.ServiceRoleArn = {
          'Fn::GetAtt': [roleLogicalId, 'Arn'],
        };
        merge(resources, role);
      }
    }

    return resources;
  }

  getDynamoDbConfig(
    config: DsDynamoDBConfig,
  ): CfnDataSource['Properties']['DynamoDBConfig'] {
    return {
      AwsRegion: config.config.region || { Ref: 'AWS::Region' },
      TableName: config.config.tableName,
      UseCallerCredentials: !!config.config.useCallerCredentials,
      ...this.getDeltaSyncConfig(config),
    };
  }

  getDeltaSyncConfig(config: DsDynamoDBConfig) {
    if (config.config.versioned && config.config.deltaSyncConfig) {
      return {
        Versioned: true,
        DeltaSyncConfig: {
          BaseTableTTL: config.config.deltaSyncConfig.baseTableTTL || 43200,
          DeltaSyncTableName: config.config.deltaSyncConfig.deltaSyncTableName,
          DeltaSyncTableTTL:
            config.config.deltaSyncConfig.deltaSyncTableTTL || 1440,
        },
      };
    }
  }

  getEventBridgeConfig(
    config: DsEventBridgeConfig,
  ): CfnDataSource['Properties']['EventBridgeConfig'] {
    return {
      EventBusArn: config.config.eventBusArn,
    };
  }

  getOpenSearchConfig(
    config: DsOpenSearchConfig,
  ): CfnDataSource['Properties']['OpenSearchServiceConfig'] {
    const endpoint =
      config.config.endpoint ||
      (config.config.domain && {
        'Fn::Join': [
          '',
          [
            'https://',
            { 'Fn::GetAtt': [config.config.domain, 'DomainEndpoint'] },
          ],
        ],
      });
    // FIXME: can we validate this and make TS infer mutually eclusive types?
    if (!endpoint) {
      throw new this.api.plugin.serverless.classes.Error(
        'Specify eithe rendpoint or domain',
      );
    }
    return {
      AwsRegion: config.config.region || { Ref: 'AWS::Region' },
      Endpoint: endpoint,
    };
  }

  getRelationalDbConfig(
    config: DsRelationalDbConfig,
  ): CfnDataSource['Properties']['RelationalDatabaseConfig'] {
    return {
      RdsHttpEndpointConfig: {
        AwsRegion: config.config.region || { Ref: 'AWS::Region' },
        DbClusterIdentifier: {
          'Fn::Join': [
            ':',
            [
              'arn',
              'aws',
              'rds',
              config.config.region || { Ref: 'AWS::Region' },
              { Ref: 'AWS::AccountId' },
              'cluster',
              config.config.dbClusterIdentifier,
            ],
          ],
        },
        DatabaseName: config.config.databaseName,
        Schema: config.config.schema,
        AwsSecretStoreArn: config.config.awsSecretStoreArn,
      },
      RelationalDatabaseSourceType:
        config.config.relationalDatabaseSourceType || 'RDS_HTTP_ENDPOINT',
    };
  }

  getHttpConfig(
    config: DsHttpConfig,
  ): CfnDataSource['Properties']['HttpConfig'] {
    return {
      Endpoint: config.config.endpoint,
      ...this.getHttpAuthorizationConfig(config),
    };
  }

  getHttpAuthorizationConfig(config: DsHttpConfig) {
    const authConfig = config.config.authorizationConfig;
    if (authConfig) {
      return {
        AuthorizationConfig: {
          AuthorizationType: authConfig.authorizationType,
          AwsIamConfig: {
            SigningRegion: authConfig.awsIamConfig.signingRegion || {
              Ref: 'AWS::Region',
            },
            SigningServiceName: authConfig.awsIamConfig.signingServiceName,
          },
        },
      };
    }
  }

  compileDataSourceIamRole(): CfnResources | undefined {
    if ('config' in this.config && this.config.config.serviceRoleArn) {
      return;
    }

    let statements: IamStatement[] | undefined;

    if (
      this.config.type === 'HTTP' &&
      this.config.config &&
      this.config.config.authorizationConfig &&
      this.config.config.authorizationConfig.authorizationType === 'AWS_IAM' &&
      !this.config.config.iamRoleStatements
    ) {
      throw new this.api.plugin.serverless.classes.Error(
        `${this.config.name}: When using AWS_IAM signature, you must also specify the required iamRoleStatements`,
      );
    }

    if ('config' in this.config && this.config.config.iamRoleStatements) {
      statements = this.config.config.iamRoleStatements;
    } else {
      // Try to generate default statements for the given this.config.
      statements = this.getDefaultDataSourcePolicyStatements();
    }

    if (!statements || statements.length === 0) {
      return;
    }

    const logicalId = Naming.getDataSourceRoleLogicalId(this.config.name);

    return {
      [logicalId]: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: ['appsync.amazonaws.com'],
                },
                Action: ['sts:AssumeRole'],
              },
            ],
          },
          Policies: [
            {
              PolicyName: `AppSync-Datasource-${this.config.name}`,
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: statements,
              },
            },
          ],
        },
      },
    };
  }

  getDefaultDataSourcePolicyStatements(): IamStatement[] | undefined {
    switch (this.config.type) {
      case 'AWS_LAMBDA': {
        const lambdaArn = this.api.getLambdaArn(
          this.config.config,
          Naming.getDataSourceEmbeddedLambdaResolverName(this.config),
        );

        // Allow "invoke" for the Datasource's function and its aliases/versions
        const defaultLambdaStatement: IamStatement = {
          Action: ['lambda:invokeFunction'],
          Effect: 'Allow',
          Resource: [lambdaArn, { 'Fn::Join': [':', [lambdaArn, '*']] }],
        };

        return [defaultLambdaStatement];
      }
      case 'AMAZON_DYNAMODB': {
        const dynamoDbResourceArn: IntrinsicFunction = {
          'Fn::Join': [
            ':',
            [
              'arn',
              'aws',
              'dynamodb',
              this.config.config.region || { Ref: 'AWS::Region' },
              { Ref: 'AWS::AccountId' },
              `table`,
            ],
          ],
        };

        // Allow any action on the Datasource's table
        const defaultDynamoDBStatement: IamStatement = {
          Action: [
            'dynamodb:DeleteItem',
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:UpdateItem',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem',
            'dynamodb:ConditionCheckItem',
          ],
          Effect: 'Allow',
          Resource: [
            {
              'Fn::Join': [
                '/',
                [dynamoDbResourceArn, this.config.config.tableName],
              ],
            },
            {
              'Fn::Join': [
                '/',
                [dynamoDbResourceArn, this.config.config.tableName, '*'],
              ],
            },
          ],
        };

        return [defaultDynamoDBStatement];
      }
      case 'RELATIONAL_DATABASE': {
        const dDbResourceArn: IntrinsicFunction = {
          'Fn::Join': [
            ':',
            [
              'arn',
              'aws',
              'rds',
              this.config.config.region || { Ref: 'AWS::Region' },
              { Ref: 'AWS::AccountId' },
              'cluster',
              this.config.config.dbClusterIdentifier,
            ],
          ],
        };
        const dbStatement: IamStatement = {
          Effect: 'Allow',
          Action: [
            'rds-data:DeleteItems',
            'rds-data:ExecuteSql',
            'rds-data:ExecuteStatement',
            'rds-data:GetItems',
            'rds-data:InsertItems',
            'rds-data:UpdateItems',
          ],
          Resource: [
            dDbResourceArn,
            { 'Fn::Join': [':', [dDbResourceArn, '*']] },
          ],
        };

        const secretManagerStatement: IamStatement = {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [
            this.config.config.awsSecretStoreArn,
            { 'Fn::Join': [':', [this.config.config.awsSecretStoreArn, '*']] },
          ],
        };

        return [dbStatement, secretManagerStatement];
      }
      case 'AMAZON_OPENSEARCH_SERVICE': {
        let arn;
        if (
          this.config.config.endpoint &&
          typeof this.config.config.endpoint === 'string'
        ) {
          // FIXME: Do new domains have a different API? (opensearch)
          const rx =
            /^https:\/\/([a-z0-9-]+\.(\w{2}-[a-z]+-\d)\.es\.amazonaws\.com)$/;
          const result = rx.exec(this.config.config.endpoint);
          if (!result) {
            throw new this.api.plugin.serverless.classes.Error(
              `Invalid AWS OpenSearch endpoint: '${this.config.config.endpoint}`,
            );
          }
          arn = {
            'Fn::Join': [
              ':',
              [
                'arn',
                'aws',
                'es',
                result[2],
                { Ref: 'AWS::AccountId' },
                `domain/${result[1]}/*`,
              ],
            ],
          };
        } else if (this.config.config.domain) {
          arn = {
            'Fn::Join': [
              '/',
              [{ 'Fn::GetAtt': [this.config.config.domain, 'Arn'] }, '*'],
            ],
          };
        } else {
          throw new this.api.plugin.serverless.classes.Error(
            `Could not determine the Arn for dataSource '${this.config.name}`,
          );
        }

        // Allow any action on the Datasource's ES endpoint
        const defaultESStatement: IamStatement = {
          Action: [
            'es:ESHttpDelete',
            'es:ESHttpGet',
            'es:ESHttpHead',
            'es:ESHttpPost',
            'es:ESHttpPut',
            'es:ESHttpPatch',
          ],
          Effect: 'Allow',
          Resource: [arn],
        };

        return [defaultESStatement];
      }
      case 'AMAZON_EVENTBRIDGE': {
        // Allow PutEvents on the EventBridge bus
        const defaultEventBridgeStatement: IamStatement = {
          Action: ['events:PutEvents'],
          Effect: 'Allow',
          Resource: [this.config.config.eventBusArn],
        };

        return [defaultEventBridgeStatement];
      }
    }
  }
}

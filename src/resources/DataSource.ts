import { merge } from 'lodash';
import { has } from 'ramda';
import {
  CfnDataSource,
  CfnResources,
  IntrinsictFunction,
} from 'types/cloudFormation';
import { DataSourceConfig, IamStatement } from 'types/plugin';
import { Api } from './Api';

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
        LambdaFunctionArn: this.api.getLambdaArn(this.config.config),
      };
    } else if (this.config.type === 'AMAZON_DYNAMODB') {
      resource.Properties.DynamoDBConfig = {
        AwsRegion: this.config.config.region || { Ref: 'AWS::Region' },
        TableName: this.config.config.tableName,
        UseCallerCredentials: !!this.config.config.useCallerCredentials,
        Versioned: !!this.config.config.versioned,
      };
      if (this.config.config.versioned) {
        resource.Properties.DynamoDBConfig.DeltaSyncConfig =
          this.getDeltaSyncConfig();
      }
    } else if (
      this.config.type === 'AMAZON_ELASTICSEARCH' ||
      this.config.type === 'AMAZON_OPENSEARCH_SERVICE'
    ) {
      const endpoint =
        this.config.config.endpoint ||
        (this.config.config.domain && {
          'Fn::Join': [
            '',
            [
              'https://',
              { 'Fn::GetAtt': [this.config.config.domain, 'DomainEndpoint'] },
            ],
          ],
        });
      // FIXME: can we validate this and make TS infer mutually eclusive types?
      if (!endpoint) {
        throw new Error('Specify eithe rendpoint or domain');
      }
      resource.Properties.ElasticsearchConfig = {
        AwsRegion: this.config.config.region || { Ref: 'AWS::Region' },
        Endpoint: endpoint,
      };
    } else if (this.config.type === 'RELATIONAL_DATABASE') {
      resource.Properties.RelationalDatabaseConfig = {
        RdsHttpEndpointConfig: {
          AwsRegion: this.config.config.region || { Ref: 'AWS::Region' },
          DbClusterIdentifier: this.api.generateDbClusterArn(
            this.config.config,
          ),
          DatabaseName: this.config.config.databaseName,
          Schema: this.config.config.schema,
          AwsSecretStoreArn: this.config.config.awsSecretStoreArn,
        },
        RelationalDatabaseSourceType:
          this.config.config.relationalDatabaseSourceType ||
          'RDS_HTTP_ENDPOINT',
      };
    } else if (this.config.type === 'HTTP') {
      const authConfig = this.config.config.authorizationConfig;
      const authorizationConfig = {
        ...(authConfig && {
          AuthorizationConfig: {
            ...(authConfig.authorizationType && {
              AuthorizationType: authConfig.authorizationType,
            }),
            ...(authConfig.awsIamConfig && {
              AwsIamConfig: {
                SigningRegion: authConfig.awsIamConfig.signingRegion || {
                  Ref: 'AWS::Region',
                },
                ...(authConfig.awsIamConfig.signingServiceName && {
                  SigningServiceName:
                    authConfig.awsIamConfig.signingServiceName,
                }),
              },
            }),
          },
        }),
      };

      resource.Properties.HttpConfig = {
        Endpoint: this.config.config.endpoint,
        ...authorizationConfig,
      };
    } else if (this.config.type !== 'NONE') {
      // FIXME: take validation elsewhere
      // @ts-ignore
      throw new Error(`Data Source Type not supported: ${this.config.type}`);
    }

    const logicalId = this.api.naming.getDataSourceLogicalId(this.config.name);

    const resources = {
      [logicalId]: resource,
    };

    if (has('config', this.config) && this.config.config.serviceRoleArn) {
      resource.Properties.ServiceRoleArn = this.config.config.serviceRoleArn;
    } else {
      const role = this.compileDataSourceIamRole();
      if (role) {
        const roleLogicalId = this.api.naming.getDataSourceRoleLogicalId(
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

  getDeltaSyncConfig() {
    if (this.config.type !== 'AMAZON_DYNAMODB') {
      return undefined;
    }
    // FIXME: move to proper validation
    if (!this.config.config.deltaSyncConfig) {
      throw new Error(
        'You must specify `deltaSyncConfig` for Delta Sync configuration.',
      );
    }

    return {
      BaseTableTTL: this.config.config.deltaSyncConfig.baseTableTTL || 0,
      DeltaSyncTableName: this.config.config.deltaSyncConfig.deltaSyncTableName,
      DeltaSyncTableTTL:
        this.config.config.deltaSyncConfig.deltaSyncTableTTL || 60,
    };
  }

  compileDataSourceIamRole(): CfnResources | undefined {
    if (has('config', this.config) && this.config.config.serviceRoleArn) {
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
      throw new Error(
        `${this.config.name}: When using AWS_IAM signature, you must also specify the required iamRoleStatements`,
      );
    }

    if (has('config', this.config) && this.config.config.iamRoleStatements) {
      statements = this.config.config.iamRoleStatements;
    } else {
      // Try to generate default statements for the given this.config.
      statements = this.getDefaultDataSourcePolicyStatements();
    }

    if (!statements || statements.length === 0) {
      return;
    }

    const logicalId = this.api.naming.getDataSourceRoleLogicalId(
      this.config.name,
    );

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
        const lambdaArn = this.api.getLambdaArn(this.config.config);

        // Allow "invoke" for the Datasource's function and its aliases/versions
        const defaultLambdaStatement: IamStatement = {
          Action: ['lambda:invokeFunction'],
          Effect: 'Allow',
          Resource: [lambdaArn, { 'Fn::Join': [':', [lambdaArn, '*']] }],
        };

        return [defaultLambdaStatement];
      }
      case 'AMAZON_DYNAMODB': {
        const dynamoDbResourceArn: IntrinsictFunction = {
          'Fn::Join': [
            ':',
            [
              'arn',
              'aws',
              'dynamodb',
              this.config.config.region || { Ref: 'AWS::Region' },
              { Ref: 'AWS::AccountId' },
              `table/${this.config.config.tableName}`,
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
            dynamoDbResourceArn,
            { 'Fn::Join': ['/', [dynamoDbResourceArn, '*']] },
          ],
        };

        return [defaultDynamoDBStatement];
      }
      case 'RELATIONAL_DATABASE': {
        const dDbResourceArn: IntrinsictFunction = {
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
      case 'AMAZON_OPENSEARCH_SERVICE':
      case 'AMAZON_ELASTICSEARCH': {
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
            throw new Error(
              `Invalid AWS ElasticSearch endpoint: '${this.config.config.endpoint}`,
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
          throw new Error(
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
    }
  }
}

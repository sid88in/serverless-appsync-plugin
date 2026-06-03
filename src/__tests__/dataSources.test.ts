import { Api } from '../resources/Api';
import { DataSource } from '../resources/DataSource';
import * as given from './given';

const plugin = given.plugin();

describe('DataSource', () => {
  describe('DynamoDB', () => {
    // Regression guard for #352: generated resource ARNs must derive the
    // partition from CloudFormation (`AWS::Partition`) so they are valid in
    // the aws-cn (China) and aws-us-gov (GovCloud) partitions, not hardcoded
    // to "aws".
    it('should derive the resource ARN partition from AWS::Partition', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        config: {
          tableName: 'data',
        },
      });
      const role = JSON.stringify(dataSource.compileDataSourceIamRole());
      expect(role).toContain('"Ref":"AWS::Partition"');
      expect(role).not.toContain('"arn","aws"');
    });

    it('should generate Resource with default role', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate Resource with default deltaSync', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          versioned: true,
          deltaSyncConfig: {
            deltaSyncTableName: 'syncTable',
            baseTableTTL: 60,
            deltaSyncTableTTL: 120,
          },
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with custom region', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          region: 'us-east-2',
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with a Ref for the table name', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: { Ref: 'MyTable' },
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with custom statement', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['dynamodb:GetItem'],
              Resource: ['arn:aws:dynamodb:us-east-1:12345678:myTable'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('EventBridge', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_EVENTBRIDGE',
        name: 'eventBridge',
        description: 'My eventBridge bus',
        config: {
          eventBusArn:
            'arn:aws:events:us-east-1:123456789012:event-bus/default',
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with a Ref for the bus ARN', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_EVENTBRIDGE',
        name: 'eventBridge',
        description: 'My eventBridge bus',
        config: {
          eventBusArn: { 'Fn::GetAtt': ['MyEventBus', 'Arn'] },
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with custom statement', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_EVENTBRIDGE',
        name: 'eventBridge',
        description: 'My eventBridge bus',
        config: {
          eventBusArn:
            'arn:aws:events:us-east-1:123456789012:event-bus/default',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['events:PutEvents'],
              Resource: [
                'arn:aws:events:us-east-1:123456789012:event-bus/default',
                'arn:aws:events:us-east-1:123456789012:event-bus/other',
              ],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when a service role arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_EVENTBRIDGE',
        name: 'eventBridge',
        description: 'My eventBridge bus',
        config: {
          eventBusArn:
            'arn:aws:events:us-east-1:123456789012:event-bus/default',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('Bedrock', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_BEDROCK_RUNTIME',
        name: 'bedrock',
        description: 'My Bedrock data source',
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with scoped models', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_BEDROCK_RUNTIME',
        name: 'bedrock',
        description: 'My Bedrock data source',
        config: {
          models: [
            'amazon.titan-text-lite-v1',
            'arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0',
          ],
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with custom statement', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_BEDROCK_RUNTIME',
        name: 'bedrock',
        description: 'My Bedrock data source',
        config: {
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['bedrock:InvokeModel'],
              Resource: ['*'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when a service role arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_BEDROCK_RUNTIME',
        name: 'bedrock',
        description: 'My Bedrock data source',
        config: {
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('AWS Lambda', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myFunction',
        description: 'My lambda resolver',
        config: {
          functionName: 'myFunction',
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate Resource with embedded function', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myDataSource',
        description: 'My lambda resolver',
        config: {
          function: {
            handler: 'index.handler',
          },
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
      expect(api.functions).toMatchSnapshot();
    });

    it('should generate default role with custom statements', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myFunction',
        description: 'My lambda resolver',
        config: {
          functionName: 'myFunction',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['lambda:invokeFunction'],
              Resource: [{ Ref: 'MyFunction' }],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AWS_LAMBDA',
        name: 'myFunction',
        description: 'My lambda resolver',
        config: {
          functionName: 'myFunction',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('HTTP', () => {
    it('should generate Resource without roles', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://api.example.com',
        },
      });

      expect(dataSource.compile()).toMatchInlineSnapshot(`
        {
          "GraphQlDsmyEndpoint": {
            "Properties": {
              "ApiId": {
                "Fn::GetAtt": [
                  "GraphQlApi",
                  "ApiId",
                ],
              },
              "Description": "My HTTP resolver",
              "HttpConfig": {
                "Endpoint": "https://api.example.com",
              },
              "Name": "myEndpoint",
              "Type": "HTTP",
            },
            "Type": "AWS::AppSync::DataSource",
          },
        }
      `);
    });

    it('should generate Resource with IAM authorization config', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://events.us-east-1.amazonaws.com/',
          authorizationConfig: {
            authorizationType: 'AWS_IAM',
            awsIamConfig: {
              signingRegion: { Ref: 'AWS::Region' },
              signingServiceName: 'events',
            },
          },
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['events:PutEvents'],
              Resource: ['*'],
            },
          ],
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with custom statements', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://events.us-east-1.amazonaws.com/',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['events:PutEvents'],
              Resource: ['*'],
            },
          ],
          authorizationConfig: {
            authorizationType: 'AWS_IAM',
            awsIamConfig: {
              signingRegion: { Ref: 'AWS::Region' },
              signingServiceName: 'events',
            },
          },
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'HTTP',
        name: 'myEndpoint',
        description: 'My HTTP resolver',
        config: {
          endpoint: 'https://events.us-east-1.amazonaws.com/',
          serviceRoleArn: 'arn:aws:iam:',
          authorizationConfig: {
            authorizationType: 'AWS_IAM',
            awsIamConfig: {
              signingRegion: { Ref: 'AWS::Region' },
              signingServiceName: 'events',
            },
          },
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('OpenSearch', () => {
    it('should generate Resource without roles', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          domain: 'myDomain',
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate Resource with endpoint', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          endpoint: 'https://mydomain.us-east-1.es.amazonaws.com',
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate default role with custom statements', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          domain: 'myDomain',
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['es:ESHttpGet'],
              Resource: ['arn:aws:es:us-east-1:12345678:domain/myDomain'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_OPENSEARCH_SERVICE',
        name: 'opensearch',
        description: 'OpenSearch resolver',
        config: {
          domain: 'myDomain',
          serviceRoleArn: 'arn:aim::',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });

  describe('Relational Databases', () => {
    it('should generate Resource with default role', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'RELATIONAL_DATABASE',
        name: 'myDatabase',
        description: 'My RDS database',
        config: {
          dbClusterIdentifier: 'myCluster',
          databaseName: 'myDatabase',
          awsSecretStoreArn: { Ref: 'MyRdsCluster' },
        },
      });

      expect(dataSource.compile()).toMatchSnapshot();
    });

    it('should generate DynamoDB default role with custom statement', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'RELATIONAL_DATABASE',
        name: 'myDatabase',
        description: 'My RDS database',
        config: {
          dbClusterIdentifier: 'myCluster',
          databaseName: 'myDatabase',
          awsSecretStoreArn: { Ref: 'MyRdsCluster' },
          iamRoleStatements: [
            {
              Effect: 'Allow',
              Action: ['rds-data:DeleteItems'],
              Resource: ['arn:aws:rds:us-east-1:12345678:cluster:myCluster'],
            },
          ],
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toMatchSnapshot();
    });

    it('should not generate default role when arn is passed', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const dataSource = new DataSource(api, {
        type: 'AMAZON_DYNAMODB',
        name: 'dynamo',
        description: 'My dynamo table',
        config: {
          tableName: 'data',
          region: 'us-east-1',
          serviceRoleArn: 'arn:aws:iam:',
        },
      });

      expect(dataSource.compileDataSourceIamRole()).toBeUndefined();
    });
  });
});

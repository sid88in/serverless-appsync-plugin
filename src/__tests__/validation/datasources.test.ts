import { validateConfig } from '../../validation';
import { basicConfig } from '../basicConfig';

describe('Valdiation', () => {
  describe('DynamoDB', () => {
    describe('Valid', () => {
      const assertions = [
        {
          name: 'Valid DynamoDB config',
          config: {
            dataSources: {
              myDynamoSource1: {
                type: 'AMAZON_DYNAMODB',
                config: {
                  tableName: 'myTable',
                },
              },
              myDynamoSource2: {
                type: 'AMAZON_DYNAMODB',
                config: {
                  tableName: { Ref: 'MyTable' },
                  region: { 'Fn::Sub': '${AWS::Region}' },
                  serviceRoleArn: { 'Fn::GetAtt': 'MyRole.Arn' },
                },
              },
              myDynamoSource3: {
                type: 'AMAZON_DYNAMODB',
                config: {
                  tableName: 'myTable',
                  useCallerCredentials: true,
                  region: 'us-east-2',
                  serviceRoleArn: 'arn:',
                  iamRoleStatements: [
                    {
                      Effect: 'Allow',
                      Action: ['DynamoDB:PutItem'],
                      Resource: ['arn:dynamodb:'],
                    },
                  ],
                  versioned: true,
                  deltaSyncConfig: {
                    deltaSyncTableName: 'deltaSyncTable',
                    baseTableTTL: 60,
                    deltaSyncTableTTL: 60,
                  },
                },
              },
            },
          },
        },
        {
          name: 'Valid DynamoDB config, as array of maps',
          config: {
            dataSources: [
              {
                myDynamoSource1: {
                  type: 'AMAZON_DYNAMODB',
                  config: {
                    tableName: 'myTable',
                  },
                },
              },
            ],
          },
        },
      ];

      assertions.forEach((config) => {
        it(`should validate a ${config.name}`, () => {
          expect(validateConfig({ ...basicConfig, ...config.config })).toBe(
            true,
          );
        });
      });
    });
  });

  describe('Invalid', () => {
    const assertions = [
      {
        name: 'Missing config',
        config: {
          dataSources: {
            myDynamoSource1: {
              type: 'AMAZON_DYNAMODB',
            },
          },
        },
      },
      {
        name: 'Empty config',
        config: {
          dataSources: {
            myDynamoSource1: {
              type: 'AMAZON_DYNAMODB',
              config: {},
            },
          },
        },
      },
      {
        name: 'Invalid config',
        config: {
          dataSources: {
            myDynamoSource1: {
              type: 'AMAZON_DYNAMODB',
              config: {
                tableName: 123,
                useCallerCredentials: 'foo',
                region: 123,
                serviceRoleArn: 456,
                iamRoleStatements: [{}],
                versioned: 'bar',
                deltaSyncConfig: {
                  baseTableTTL: '123',
                  deltaSyncTableTTL: '456',
                },
              },
            },
          },
        },
      },
    ];

    assertions.forEach((config) => {
      it(`should validate: ${config.name}`, () => {
        expect(function () {
          validateConfig({
            ...basicConfig,
            ...config.config,
          });
        }).toThrowErrorMatchingSnapshot();
      });
    });
  });
});

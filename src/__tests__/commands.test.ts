import { runServerless } from './utils';
import * as utils from '../utils';

const describeStackResources = jest.fn().mockResolvedValue({
  StackResources: [
    {
      ResourceType: 'AWS::AppSync::GraphQLApi',
      PhysicalResourceId: 'appSyync/123456789',
    },
  ],
});

afterEach(() => {
  describeStackResources.mockClear();
});

describe('commands', () => {
  describe('create domain', () => {
    it('should create a domain', async () => {
      const createDomainName = jest.fn();
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          AppSync: {
            createDomainName,
          },
        },
        command: 'appsync domain create',
      });

      expect(createDomainName).toHaveBeenCalledTimes(1);
      expect(createDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493",
                "domainName": "api.example.com",
              }
          `);
      expect(result.stdoutData).toMatchSnapshot();
    });
  });

  describe('delete domain', () => {
    it('should delete a domain, asking for confirmation', async () => {
      const deleteDomainName = jest.fn();
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(true);

      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          AppSync: {
            deleteDomainName,
          },
        },
        command: 'appsync domain delete',
      });

      expect(deleteDomainName).toHaveBeenCalledTimes(1);
      expect(deleteDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
        Object {
          "domainName": "api.example.com",
        }
      `);
      expect(confirmSpy).toHaveBeenCalled();
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });

    it('should delete a domain, skipping confirmation when the yes flag is passed', async () => {
      const deleteDomainName = jest.fn();
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(true);

      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          AppSync: {
            deleteDomainName,
          },
        },
        command: 'appsync domain delete',
        options: {
          yes: true,
        },
      });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(deleteDomainName).toHaveBeenCalledTimes(1);
      expect(deleteDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
        Object {
          "domainName": "api.example.com",
        }
      `);
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });

    it('should not delete a domain, when not confirmed', async () => {
      const deleteDomainName = jest.fn();
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(false);

      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          AppSync: {
            deleteDomainName,
          },
        },
        command: 'appsync domain delete',
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(deleteDomainName).not.toHaveBeenCalled();
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });
  });

  describe('assoc domain', () => {
    it('should associate a domain', async () => {
      const associateApi = jest.fn();

      const getApiAssociation = jest
        .fn()
        .mockResolvedValueOnce({
          apiAssociation: {
            // FIXME: this should throw a ServerlessError instead
            associationStatus: 'NOT_FOUND',
          },
        })
        .mockResolvedValue({
          apiAssociation: {
            associationStatus: 'SUCCESS',
          },
        });
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { associateApi, getApiAssociation },
        },
        command: 'appsync domain assoc',
      });

      expect(describeStackResources).toHaveBeenCalledTimes(1);
      expect(getApiAssociation).toHaveBeenCalledTimes(2);
      expect(associateApi).toHaveBeenCalledTimes(1);
      expect(getApiAssociation.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(associateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "apiId": "123456789",
                "domainName": "api.example.com",
              }
          `);
      expect(result.stdoutData).toMatchSnapshot();
    });

    it('should ask for confirmation when already associated', async () => {
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(true);
      const associateApi = jest.fn();

      const getApiAssociation = jest
        .fn()
        .mockResolvedValueOnce({
          apiAssociation: {
            apiId: '987654321',
            associationStatus: 'SUCCESS',
          },
        })
        .mockResolvedValue({
          apiAssociation: {
            associationStatus: 'SUCCESS',
          },
        });
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { associateApi, getApiAssociation },
        },
        command: 'appsync domain assoc',
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(describeStackResources).toHaveBeenCalledTimes(1);
      expect(getApiAssociation).toHaveBeenCalledTimes(2);
      expect(associateApi).toHaveBeenCalledTimes(1);
      expect(getApiAssociation.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(associateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "apiId": "123456789",
                "domainName": "api.example.com",
              }
          `);
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });

    it('should not ask for confirmation when yes flag is passed', async () => {
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(true);
      const associateApi = jest.fn();

      const getApiAssociation = jest
        .fn()
        .mockResolvedValueOnce({
          apiAssociation: {
            apiId: '987654321',
            associationStatus: 'SUCCESS',
          },
        })
        .mockResolvedValue({
          apiAssociation: {
            associationStatus: 'SUCCESS',
          },
        });
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { associateApi, getApiAssociation },
        },
        command: 'appsync domain assoc',
        options: {
          yes: true,
        },
      });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(describeStackResources).toHaveBeenCalledTimes(1);
      expect(getApiAssociation).toHaveBeenCalledTimes(2);
      expect(associateApi).toHaveBeenCalledTimes(1);
      expect(getApiAssociation.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(associateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "apiId": "123456789",
                "domainName": "api.example.com",
              }
          `);
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });
  });

  describe('domain disassoc', () => {
    it('should disassociate a domain, asking for confirmation ', async () => {
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(true);
      const disassociateApi = jest.fn();

      const getApiAssociation = jest
        .fn()
        .mockResolvedValueOnce({
          apiAssociation: {
            apiId: '123456789',
            associationStatus: 'SUCCESS',
          },
        })
        .mockResolvedValue({
          apiAssociation: {
            associationStatus: 'NOT_FOUND',
          },
        });
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { disassociateApi, getApiAssociation },
        },
        command: 'appsync domain disassoc',
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(describeStackResources).toHaveBeenCalledTimes(1);
      expect(getApiAssociation).toHaveBeenCalledTimes(2);
      expect(disassociateApi).toHaveBeenCalledTimes(1);
      expect(getApiAssociation.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(disassociateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });

    it('should disassociate a domain, skipping confirmation when the yes flag is passed', async () => {
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(true);
      const disassociateApi = jest.fn();

      const getApiAssociation = jest
        .fn()
        .mockResolvedValueOnce({
          apiAssociation: {
            apiId: '123456789',
            associationStatus: 'SUCCESS',
          },
        })
        .mockResolvedValue({
          apiAssociation: {
            associationStatus: 'NOT_FOUND',
          },
        });
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { disassociateApi, getApiAssociation },
        },
        command: 'appsync domain disassoc',
        options: {
          yes: true,
        },
      });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(describeStackResources).toHaveBeenCalledTimes(1);
      expect(getApiAssociation).toHaveBeenCalledTimes(2);
      expect(disassociateApi).toHaveBeenCalledTimes(1);
      expect(getApiAssociation.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(disassociateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });

    it('should not disassociate a domain, when not confirmed', async () => {
      const confirmSpy = jest
        .spyOn(utils, 'confirmAction')
        .mockResolvedValue(false);
      const disassociateApi = jest.fn();

      const getApiAssociation = jest.fn().mockResolvedValueOnce({
        apiAssociation: {
          apiId: '123456789',
          associationStatus: 'SUCCESS',
        },
      });
      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { disassociateApi, getApiAssociation },
        },
        command: 'appsync domain disassoc',
      });

      expect(describeStackResources).toHaveBeenCalledTimes(1);
      expect(getApiAssociation).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalled();
      expect(disassociateApi).not.toHaveBeenCalled();
      expect(result.stdoutData).toMatchSnapshot();
      confirmSpy.mockRestore();
    });
  });

  describe('domain create-record', () => {
    it('should create a route53 record', async () => {
      const getDomainName = jest.fn().mockResolvedValue({
        domainNameConfig: {
          appsyncDomainName: 'qbcdefghij.cloudfront.net',
        },
      });
      const listHostedZonesByName = jest.fn().mockResolvedValue({
        HostedZones: [
          {
            Id: '/hostedzone/KLMNOPK',
            Name: 'example.com.',
          },
        ],
      });
      const changeResourceRecordSets = jest.fn().mockResolvedValue({
        ChangeInfo: {
          Id: '1234567890',
          Status: 'PENDING',
        },
      });
      const getChange = jest.fn().mockResolvedValue({
        ChangeInfo: {
          Id: '1234567890',
          Status: 'INSYNC',
        },
      });

      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { getDomainName },
          Route53: {
            changeResourceRecordSets,
            listHostedZonesByName,
            getChange,
          },
        },
        command: 'appsync domain create-record',
      });

      expect(getDomainName).toHaveBeenCalledTimes(1);
      expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
      expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
      expect(getChange).toHaveBeenCalledTimes(1);
      expect(getDomainName.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ]
      `);
      expect(changeResourceRecordSets.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "ChangeBatch": Object {
              "Changes": Array [
                Object {
                  "Action": "CREATE",
                  "ResourceRecordSet": Object {
                    "Name": "api.example.com",
                    "ResourceRecords": Array [
                      Object {
                        "Value": "qbcdefghij.cloudfront.net",
                      },
                    ],
                    "TTL": 300,
                    "Type": "CNAME",
                  },
                },
              ],
            },
            "HostedZoneId": "KLMNOPK",
          },
        ]
      `);
      expect(getChange.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "Id": "1234567890",
          },
        ]
      `);
      expect(result.stdoutData).toMatchSnapshot();
    });
  });

  describe('domain delete-record', () => {
    it('should delete a route53 record', async () => {
      const getDomainName = jest.fn().mockResolvedValue({
        domainNameConfig: {
          appsyncDomainName: 'qbcdefghij.cloudfront.net',
        },
      });
      const listHostedZonesByName = jest.fn().mockResolvedValue({
        HostedZones: [
          {
            Id: '/hostedzone/KLMNOPK',
            Name: 'example.com.',
          },
        ],
      });
      const changeResourceRecordSets = jest.fn().mockResolvedValue({
        ChangeInfo: {
          Id: '1234567890',
          Status: 'PENDING',
        },
      });
      const getChange = jest.fn().mockResolvedValue({
        ChangeInfo: {
          Id: '1234567890',
          Status: 'INSYNC',
        },
      });

      const result = await runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          CloudFormation: { describeStackResources },
          AppSync: { getDomainName },
          Route53: {
            changeResourceRecordSets,
            listHostedZonesByName,
            getChange,
          },
        },
        command: 'appsync domain delete-record',
      });

      expect(getDomainName).toHaveBeenCalledTimes(1);
      expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
      expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
      expect(getChange).toHaveBeenCalledTimes(1);
      expect(getDomainName.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ]
      `);
      expect(changeResourceRecordSets.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "ChangeBatch": Object {
              "Changes": Array [
                Object {
                  "Action": "DELETE",
                  "ResourceRecordSet": Object {
                    "Name": "api.example.com",
                    "ResourceRecords": Array [
                      Object {
                        "Value": "qbcdefghij.cloudfront.net",
                      },
                    ],
                    "TTL": 300,
                    "Type": "CNAME",
                  },
                },
              ],
            },
            "HostedZoneId": "KLMNOPK",
          },
        ]
      `);
      expect(getChange.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "Id": "1234567890",
          },
        ]
      `);
      expect(result.stdoutData).toMatchSnapshot();
    });
  });
});

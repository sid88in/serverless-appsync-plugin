import { runServerless } from './utils';
import { plugin } from './given';
import * as utils from '../utils';
import {
  CreateDomainNameCommand,
  DeleteDomainNameCommand,
  GetApiAssociationCommand,
  AssociateApiCommand,
  DisassociateApiCommand,
  GetDomainNameCommand,
  EvaluateCodeCommand,
  EvaluateMappingTemplateCommand,
  GetGraphqlApiEnvironmentVariablesCommand,
  PutGraphqlApiEnvironmentVariablesCommand,
} from '@aws-sdk/client-appsync';
import { DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import {
  ListHostedZonesByNameCommand,
  ChangeResourceRecordSetsCommand,
  GetChangeCommand,
} from '@aws-sdk/client-route-53';
import { ListCertificatesCommand } from '@aws-sdk/client-acm';

// Mock AwsClientFactory so no real AWS credentials or SDK calls are made
const mockSend = jest.fn();
jest.mock('../aws-client-factory', () => ({
  AwsClientFactory: jest.fn().mockImplementation(() => ({
    getAppSyncClient: () => ({ send: mockSend }),
    getCloudFormationClient: () => ({ send: mockSend }),
    getCloudWatchLogsClient: () => ({ send: mockSend }),
    getRoute53Client: () => ({ send: mockSend }),
    getAcmClient: () => ({ send: mockSend }),
  })),
}));

// Mock fromNodeProviderChain to avoid ESM dynamic import issues in Jest
jest.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: jest.fn().mockReturnValue({}),
}));

jest.setTimeout(30000);

const confirmSpy = jest.spyOn(utils, 'confirmAction');

// Default mockSend implementation: returns describeStackResources response for CF calls.
// Individual tests override this via mockSend.mockImplementation or mockResolvedValueOnce.
const describeStackResourcesResponse = {
  StackResources: [
    {
      ResourceType: 'AWS::AppSync::GraphQLApi',
      PhysicalResourceId: 'appSyync/123456789',
    },
  ],
};

afterEach(() => {
  mockSend.mockReset();
  confirmSpy.mockClear();
});

describe('create domain', () => {
  it('should create a domain with specified certificate ARN', async () => {
    mockSend.mockResolvedValue({});

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain create',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
            certificateArn:
              'arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493',
          },
        },
      },
    });

    const createCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof CreateDomainNameCommand,
    );
    const listCertCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof ListCertificatesCommand,
    );

    expect(createCall).toBeDefined();
    expect(listCertCall).toBeUndefined();
    expect(createCall![0].input).toMatchInlineSnapshot(`
      Object {
        "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493",
        "domainName": "api.example.com",
      }
    `);
  });

  it('should create a domain and find a matching certificate, exact match', async () => {
    mockSend.mockImplementation((cmd) => {
      if (cmd instanceof ListCertificatesCommand) {
        return Promise.resolve({
          CertificateSummaryList: [
            {
              DomainName: '*.example.com',
              CertificateArn:
                'arn:aws:acm:us-east-1:123456789012:certificate/fd8f67f7-bf19-4894-80db-0c49bf5dd507',
            },
            {
              DomainName: 'foo.example.com',
              CertificateArn:
                'arn:aws:acm:us-east-1:123456789012:certificate/932b56de-bb63-45fe-8a31-b3150fb9accd',
            },
            {
              DomainName: 'api.example.com',
              CertificateArn:
                'arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493',
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain create',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const listCertCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof ListCertificatesCommand,
    );
    const createCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof CreateDomainNameCommand,
    );

    expect(listCertCalls).toHaveLength(1);
    expect(listCertCalls[0][0].input).toMatchInlineSnapshot(`
      Object {
        "CertificateStatuses": Array [
          "ISSUED",
        ],
      }
    `);
    expect(createCall).toBeDefined();
    expect(createCall![0].input).toMatchInlineSnapshot(`
      Object {
        "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493",
        "domainName": "api.example.com",
      }
    `);
  });

  it('should fail creating a domain if ARN cannot be resolved', async () => {
    mockSend.mockImplementation((cmd) => {
      if (cmd instanceof ListCertificatesCommand) {
        return Promise.resolve({
          CertificateSummaryList: [
            {
              DomainName: 'foo.example.com',
              CertificateArn:
                'arn:aws:acm:us-east-1:123456789012:certificate/932b56de-bb63-45fe-8a31-b3150fb9accd',
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    await expect(
      runServerless({
        fixture: 'appsync',
        command: 'appsync domain create',
        configExt: {
          appSync: {
            domain: {
              useCloudFormation: false,
            },
          },
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"No certificate found for domain api.example.com."`,
    );

    const listCertCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof ListCertificatesCommand,
    );
    const createCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof CreateDomainNameCommand,
    );

    expect(listCertCalls).toHaveLength(1);
    expect(listCertCalls[0][0].input).toMatchInlineSnapshot(`
      Object {
        "CertificateStatuses": Array [
          "ISSUED",
        ],
      }
    `);
    expect(createCall).toBeUndefined();
  });

  it('should create a domain and find a matching certificate, wildcard match', async () => {
    mockSend.mockImplementation((cmd) => {
      if (cmd instanceof ListCertificatesCommand) {
        return Promise.resolve({
          CertificateSummaryList: [
            {
              DomainName: 'foo.example.com',
              CertificateArn:
                'arn:aws:acm:us-east-1:123456789012:certificate/932b56de-bb63-45fe-8a31-b3150fb9accd',
            },
            {
              DomainName: '*.example.com',
              CertificateArn:
                'arn:aws:acm:us-east-1:123456789012:certificate/fd8f67f7-bf19-4894-80db-0c49bf5dd507',
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain create',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const listCertCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof ListCertificatesCommand,
    );
    const createCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof CreateDomainNameCommand,
    );

    expect(listCertCalls).toHaveLength(1);
    expect(listCertCalls[0][0].input).toMatchInlineSnapshot(`
      Object {
        "CertificateStatuses": Array [
          "ISSUED",
        ],
      }
    `);
    expect(createCall).toBeDefined();
    expect(createCall![0].input).toMatchInlineSnapshot(`
      Object {
        "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/fd8f67f7-bf19-4894-80db-0c49bf5dd507",
        "domainName": "api.example.com",
      }
    `);
  });
});

describe('delete domain', () => {
  it('should delete a domain, asking for confirmation', async () => {
    confirmSpy.mockResolvedValue(true);
    mockSend.mockResolvedValue({});

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const deleteCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DeleteDomainNameCommand,
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('should delete a domain, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);
    mockSend.mockResolvedValue({});

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: {
        yes: true,
      },
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    const deleteCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DeleteDomainNameCommand,
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
  });

  it('should not delete a domain, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);
    mockSend.mockResolvedValue({});

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    const deleteCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DeleteDomainNameCommand,
    );
    expect(deleteCall).toBeUndefined();
  });
});

describe('assoc domain', () => {
  it('should associate a domain', async () => {
    // getApiAssocStatus called twice: first NOT_FOUND, then SUCCESS (polling)
    // describeStackResources for getApiId
    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { associationStatus: 'NOT_FOUND' },
      }) // GetApiAssociationCommand (initial check)
      .mockResolvedValueOnce({}) // AssociateApiCommand
      .mockResolvedValueOnce({
        apiAssociation: { associationStatus: 'SUCCESS' },
      }); // GetApiAssociationCommand (polling)

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const associateCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof AssociateApiCommand,
    );

    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(2);
    expect(associateCall).toBeDefined();
    expect(assocCalls.map(([cmd]) => cmd.input)).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
    expect(associateCall![0].input).toMatchInlineSnapshot(`
      Object {
        "apiId": "123456789",
        "domainName": "api.example.com",
      }
    `);
  });

  it('should handle already associated APIs', async () => {
    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '123456789', associationStatus: 'SUCCESS' },
      }); // GetApiAssociationCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const associateCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof AssociateApiCommand,
    );

    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(1);
    expect(associateCall).toBeUndefined();
    expect(assocCalls.map(([cmd]) => cmd.input)).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
  });

  it('should ask for confirmation when already associated', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '987654321', associationStatus: 'SUCCESS' },
      }) // GetApiAssociationCommand (initial — different API)
      .mockResolvedValueOnce({}) // AssociateApiCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '123456789', associationStatus: 'SUCCESS' },
      }); // GetApiAssociationCommand (polling)

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const associateCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof AssociateApiCommand,
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(2);
    expect(associateCall).toBeDefined();
    expect(assocCalls.map(([cmd]) => cmd.input)).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
    expect(associateCall![0].input).toMatchInlineSnapshot(`
      Object {
        "apiId": "123456789",
        "domainName": "api.example.com",
      }
    `);
  });

  it('should not ask for confirmation when yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '987654321', associationStatus: 'SUCCESS' },
      }) // GetApiAssociationCommand (initial — different API)
      .mockResolvedValueOnce({}) // AssociateApiCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '123456789', associationStatus: 'SUCCESS' },
      }); // GetApiAssociationCommand (polling)

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: {
        yes: true,
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const associateCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof AssociateApiCommand,
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(2);
    expect(associateCall).toBeDefined();
    expect(assocCalls.map(([cmd]) => cmd.input)).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
    expect(associateCall![0].input).toMatchInlineSnapshot(`
      Object {
        "apiId": "123456789",
        "domainName": "api.example.com",
      }
    `);
  });
});

describe('domain disassoc', () => {
  it('should disassociate a domain, asking for confirmation ', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '123456789', associationStatus: 'SUCCESS' },
      }) // GetApiAssociationCommand (initial)
      .mockResolvedValueOnce({}) // DisassociateApiCommand
      .mockResolvedValueOnce({
        apiAssociation: { associationStatus: 'NOT_FOUND' },
      }); // GetApiAssociationCommand (polling)

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain disassoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const disassocCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DisassociateApiCommand,
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(2);
    expect(disassocCall).toBeDefined();
    expect(assocCalls.map(([cmd]) => cmd.input)).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
    expect(disassocCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
  });

  it('should disassociate a domain, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '123456789', associationStatus: 'SUCCESS' },
      }) // GetApiAssociationCommand (initial)
      .mockResolvedValueOnce({}) // DisassociateApiCommand
      .mockResolvedValueOnce({
        apiAssociation: { associationStatus: 'NOT_FOUND' },
      }); // GetApiAssociationCommand (polling)

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain disassoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: {
        yes: true,
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const disassocCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DisassociateApiCommand,
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(2);
    expect(disassocCall).toBeDefined();
    expect(assocCalls.map(([cmd]) => cmd.input)).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
    expect(disassocCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
  });

  it('should not disassociate a domain, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);

    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        apiAssociation: { apiId: '123456789', associationStatus: 'SUCCESS' },
      }); // GetApiAssociationCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain disassoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const cfCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DescribeStackResourcesCommand,
    );
    const assocCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd instanceof GetApiAssociationCommand,
    );
    const disassocCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof DisassociateApiCommand,
    );

    expect(cfCall).toBeDefined();
    expect(assocCalls).toHaveLength(1);
    expect(confirmSpy).toHaveBeenCalled();
    expect(disassocCall).toBeUndefined();
  });
});

describe('domain create-record', () => {
  const getDomainNameResponse = {
    domainNameConfig: {
      appsyncDomainName: 'qbcdefghij.cloudfront.net',
      hostedZoneId: 'Z111111QQQQQQQ',
    },
  };
  const listHostedZonesResponse = {
    HostedZones: [
      {
        Id: '/hostedzone/KLMNOP',
        Name: 'example.com.',
      },
    ],
  };
  const changeRecordPendingResponse = {
    ChangeInfo: { Id: '1234567890', Status: 'PENDING' },
  };
  const getChangeInsyncResponse = {
    ChangeInfo: { Id: '1234567890', Status: 'INSYNC' },
  };

  it('should create a route53 record', async () => {
    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockResolvedValueOnce(changeRecordPendingResponse) // ChangeResourceRecordSetsCommand
      .mockResolvedValueOnce(getChangeInsyncResponse); // GetChangeCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain create-record',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const getDomainCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetDomainNameCommand,
    );
    const listZonesCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
    );
    const changeRecordCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
    );
    const getChangeCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetChangeCommand,
    );

    expect(getDomainCall).toBeDefined();
    expect(listZonesCall).toBeDefined();
    expect(changeRecordCall).toBeDefined();
    expect(getChangeCall).toBeDefined();
    expect(getDomainCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
    expect(changeRecordCall![0].input).toMatchInlineSnapshot(`
      Object {
        "ChangeBatch": Object {
          "Changes": Array [
            Object {
              "Action": "CREATE",
              "ResourceRecordSet": Object {
                "AliasTarget": Object {
                  "DNSName": "qbcdefghij.cloudfront.net",
                  "EvaluateTargetHealth": false,
                  "HostedZoneId": "Z111111QQQQQQQ",
                },
                "Name": "api.example.com",
                "Type": "A",
              },
            },
          ],
        },
        "HostedZoneId": "KLMNOP",
      }
    `);
    expect(getChangeCall![0].input).toMatchInlineSnapshot(`
      Object {
        "Id": "1234567890",
      }
    `);
  });

  it('should handle changeResourceRecordSets errors', async () => {
    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockRejectedValueOnce(
        new Error(
          "[Tried to create resource record set [name='api.example.com.', type='A'] but it already exists]",
        ),
      ); // ChangeResourceRecordSetsCommand

    await expect(
      runServerless({
        fixture: 'appsync',
        command: 'appsync domain create-record',
        configExt: {
          appSync: {
            domain: {
              useCloudFormation: false,
            },
          },
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"[Tried to create resource record set [name='api.example.com.', type='A'] but it already exists]"`,
    );

    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetDomainNameCommand),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetChangeCommand),
    ).toBeUndefined();
  });

  it('should handle changeResourceRecordSets errors silently', async () => {
    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockRejectedValueOnce(
        new Error(
          "[Tried to create resource record set [name='api.example.com.', type='A'] but it already exists]",
        ),
      ); // ChangeResourceRecordSetsCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain create-record',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: { quiet: true },
    });

    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetDomainNameCommand),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetChangeCommand),
    ).toBeUndefined();
  });

  it('should handle when appsync domain name not created', async () => {
    mockSend.mockResolvedValueOnce({
      domainNameConfig: undefined,
    }); // GetDomainNameCommand — no config

    await expect(
      runServerless({
        fixture: 'appsync',
        command: 'appsync domain create-record',
        configExt: {
          appSync: {
            domain: {
              useCloudFormation: false,
            },
          },
        },
        options: { quiet: true },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Domain api.example.com not found
      Did you forget to run 'sls appsync domain create'?"
    `);

    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetDomainNameCommand),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeUndefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
      ),
    ).toBeUndefined();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetChangeCommand),
    ).toBeUndefined();
  });
});

describe('domain delete-record', () => {
  const getDomainNameResponse = {
    domainNameConfig: {
      appsyncDomainName: 'qbcdefghij.cloudfront.net',
      hostedZoneId: 'Z111111QQQQQQQ',
    },
  };
  const listHostedZonesResponse = {
    HostedZones: [
      {
        Id: '/hostedzone/KLMNOP',
        Name: 'example.com.',
      },
    ],
  };

  it('should delete a route53 record, asking for confirmation', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockResolvedValueOnce({
        ChangeInfo: { Id: '1234567890', Status: 'PENDING' },
      }) // ChangeResourceRecordSetsCommand
      .mockResolvedValueOnce({
        ChangeInfo: { Id: '1234567890', Status: 'INSYNC' },
      }); // GetChangeCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete-record',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    const getDomainCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetDomainNameCommand,
    );
    const listZonesCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
    );
    const changeRecordCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
    );
    const getChangeCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetChangeCommand,
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(getDomainCall).toBeDefined();
    expect(listZonesCall).toBeDefined();
    expect(changeRecordCall).toBeDefined();
    expect(getChangeCall).toBeDefined();
    expect(getDomainCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
    expect(changeRecordCall![0].input).toMatchInlineSnapshot(`
      Object {
        "ChangeBatch": Object {
          "Changes": Array [
            Object {
              "Action": "DELETE",
              "ResourceRecordSet": Object {
                "AliasTarget": Object {
                  "DNSName": "qbcdefghij.cloudfront.net",
                  "EvaluateTargetHealth": false,
                  "HostedZoneId": "Z111111QQQQQQQ",
                },
                "Name": "api.example.com",
                "Type": "A",
              },
            },
          ],
        },
        "HostedZoneId": "KLMNOP",
      }
    `);
    expect(getChangeCall![0].input).toMatchInlineSnapshot(`
      Object {
        "Id": "1234567890",
      }
    `);
  });

  it('should not delete a route53 record, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);

    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse); // ListHostedZonesByNameCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete-record',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetDomainNameCommand),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
      ),
    ).toBeUndefined();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetChangeCommand),
    ).toBeUndefined();
    expect(
      mockSend.mock.calls
        .filter(([cmd]) => cmd instanceof GetDomainNameCommand)
        .map(([cmd]) => cmd.input),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "domainName": "api.example.com",
        },
      ]
    `);
  });

  it('should delete a route53 record, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockResolvedValueOnce({
        ChangeInfo: { Id: '1234567890', Status: 'PENDING' },
      }) // ChangeResourceRecordSetsCommand
      .mockResolvedValueOnce({
        ChangeInfo: { Id: '1234567890', Status: 'INSYNC' },
      }); // GetChangeCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete-record',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: { yes: true },
    });

    const getDomainCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetDomainNameCommand,
    );
    const changeRecordCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
    );
    const getChangeCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetChangeCommand,
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(getDomainCall).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeDefined();
    expect(changeRecordCall).toBeDefined();
    expect(getChangeCall).toBeDefined();
    expect(getDomainCall![0].input).toMatchInlineSnapshot(`
      Object {
        "domainName": "api.example.com",
      }
    `);
    expect(changeRecordCall![0].input).toMatchInlineSnapshot(`
      Object {
        "ChangeBatch": Object {
          "Changes": Array [
            Object {
              "Action": "DELETE",
              "ResourceRecordSet": Object {
                "AliasTarget": Object {
                  "DNSName": "qbcdefghij.cloudfront.net",
                  "EvaluateTargetHealth": false,
                  "HostedZoneId": "Z111111QQQQQQQ",
                },
                "Name": "api.example.com",
                "Type": "A",
              },
            },
          ],
        },
        "HostedZoneId": "KLMNOP",
      }
    `);
    expect(getChangeCall![0].input).toMatchInlineSnapshot(`
      Object {
        "Id": "1234567890",
      }
    `);
  });

  it('should handle changeResourceRecordSets errors', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockRejectedValueOnce(
        new Error(
          "[Tried to delete resource record set [name='api.example.com.', type='A'] but it was not found]",
        ),
      ); // ChangeResourceRecordSetsCommand

    await expect(
      runServerless({
        fixture: 'appsync',
        command: 'appsync domain delete-record',
        configExt: {
          appSync: {
            domain: {
              useCloudFormation: false,
            },
          },
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"[Tried to delete resource record set [name='api.example.com.', type='A'] but it was not found]"`,
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetDomainNameCommand),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetChangeCommand),
    ).toBeUndefined();
  });

  it('should handle changeResourceRecordSets errors silently', async () => {
    confirmSpy.mockResolvedValue(true);

    mockSend
      .mockResolvedValueOnce(getDomainNameResponse) // GetDomainNameCommand
      .mockResolvedValueOnce(listHostedZonesResponse) // ListHostedZonesByNameCommand
      .mockRejectedValueOnce(
        new Error(
          "[Tried to delete resource record set [name='api.example.com.', type='A'] but it was not found]",
        ),
      ); // ChangeResourceRecordSetsCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync domain delete-record',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: {
        quiet: true,
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetDomainNameCommand),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ListHostedZonesByNameCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(
        ([cmd]) => cmd instanceof ChangeResourceRecordSetsCommand,
      ),
    ).toBeDefined();
    expect(
      mockSend.mock.calls.find(([cmd]) => cmd instanceof GetChangeCommand),
    ).toBeUndefined();
  });
});

describe('getApiAssocStatus error handling', () => {
  it('returns { associationStatus: "NOT_FOUND" } when SDK throws NotFoundException', async () => {
    const notFoundError = Object.assign(new Error('Domain not found'), {
      name: 'NotFoundException',
    });
    mockSend.mockRejectedValueOnce(notFoundError);

    const instance = plugin();
    const result = await instance.getApiAssocStatus('api.example.com');

    expect(result).toEqual({ associationStatus: 'NOT_FOUND' });
  });

  it('re-throws unknown errors unchanged', async () => {
    const unknownError = Object.assign(new Error('Internal server error'), {
      name: 'InternalFailureException',
    });
    mockSend.mockRejectedValueOnce(unknownError);

    const instance = plugin();
    await expect(instance.getApiAssocStatus('api.example.com')).rejects.toThrow(
      unknownError,
    );
  });

  it('re-throws the exact same error object for unknown errors', async () => {
    const unknownError = Object.assign(new Error('Service unavailable'), {
      name: 'ServiceUnavailableException',
    });
    mockSend.mockRejectedValueOnce(unknownError);

    const instance = plugin();
    let thrownError: unknown;
    try {
      await instance.getApiAssocStatus('api.example.com');
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBe(unknownError);
  });

  it('does not swallow NotFoundException when name is a different error code', async () => {
    const badRequestError = Object.assign(new Error('Bad request'), {
      name: 'BadRequestException',
    });
    mockSend.mockRejectedValueOnce(badRequestError);

    const instance = plugin();
    await expect(instance.getApiAssocStatus('api.example.com')).rejects.toThrow(
      'Bad request',
    );
  });
});

describe('evaluate resolver (JS)', () => {
  it('should evaluate a JS resolver request function and print the result', async () => {
    mockSend.mockResolvedValueOnce({
      evaluationResult: '{"operation":"GetItem"}',
      logs: [],
    }); // EvaluateCodeCommand

    const instance = plugin();
    // Inject a UNIT JS resolver into the config
    (instance as any).api = {
      config: {
        resolvers: {
          'Query.getUser': {
            kind: 'UNIT',
            code: __filename, // use this test file as a stand-in (exists on disk)
          },
        },
      },
    };
    (instance as any).naming = {};
    (instance as any).options = {
      type: 'Query',
      field: 'getUser',
      function: 'request',
      context: '{}',
    };

    await instance.evaluateResolver();

    const evalCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof EvaluateCodeCommand,
    );
    expect(evalCall).toBeDefined();
    expect(evalCall![0].input.function).toBe('request');
    expect((instance as any).utils.writeText).toHaveBeenCalledWith(
      '{"operation":"GetItem"}',
    );
  });

  it('should log errors when JS evaluation fails', async () => {
    mockSend.mockResolvedValueOnce({
      error: {
        message: 'Runtime error',
        codeErrors: [
          {
            value: 'undefined is not a function',
            location: { line: 5, column: 3 },
          },
        ],
      },
      logs: ['log line 1'],
    }); // EvaluateCodeCommand

    const instance = plugin();
    (instance as any).api = {
      config: {
        resolvers: {
          'Query.getUser': {
            kind: 'UNIT',
            code: __filename,
          },
        },
      },
    };
    (instance as any).naming = {};
    (instance as any).options = {
      type: 'Query',
      field: 'getUser',
      function: 'request',
      context: '{}',
    };

    await instance.evaluateResolver();

    expect((instance as any).utils.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Runtime error'),
    );
  });

  it('should throw when resolver is not found', async () => {
    const instance = plugin();
    (instance as any).api = {
      config: { resolvers: {} },
    };
    (instance as any).naming = {};
    (instance as any).options = {
      type: 'Query',
      field: 'missing',
      context: '{}',
    };

    await expect(instance.evaluateResolver()).rejects.toThrow(
      "Resolver 'Query.missing' not found in configuration.",
    );
  });

  it('should throw when neither --template nor --type/--field are provided', async () => {
    const instance = plugin();
    (instance as any).api = { config: { resolvers: {} } };
    (instance as any).naming = {};
    (instance as any).options = { context: '{}' };

    await expect(instance.evaluateResolver()).rejects.toThrow(
      'You must specify either --template (VTL) or both --type and --field (JS resolver).',
    );
  });
});

describe('evaluate resolver (VTL template)', () => {
  it('should evaluate a VTL template and print the result', async () => {
    mockSend.mockResolvedValueOnce({
      evaluationResult: '{"version":"2018-05-29"}',
    }); // EvaluateMappingTemplateCommand

    const instance = plugin();
    (instance as any).options = {
      template: __filename, // exists on disk
      context: '{}',
    };

    await instance.evaluateResolver();

    const evalCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof EvaluateMappingTemplateCommand,
    );
    expect(evalCall).toBeDefined();
    expect((instance as any).utils.writeText).toHaveBeenCalledWith(
      '{"version":"2018-05-29"}',
    );
  });

  it('should log error when VTL evaluation fails', async () => {
    mockSend.mockResolvedValueOnce({
      error: { message: 'Template syntax error' },
    }); // EvaluateMappingTemplateCommand

    const instance = plugin();
    (instance as any).options = {
      template: __filename,
      context: '{}',
    };

    await instance.evaluateResolver();

    expect((instance as any).utils.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Template syntax error'),
    );
  });

  it('should throw when template file does not exist', async () => {
    const instance = plugin();
    (instance as any).options = {
      template: '/nonexistent/path/template.vtl',
      context: '{}',
    };

    await expect(instance.evaluateResolver()).rejects.toThrow(
      'Template file not found',
    );
  });
});

describe('env get', () => {
  it('should print environment variables', async () => {
    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        environmentVariables: { TABLE_NAME: 'prod-table', STAGE: 'prod' },
      }); // GetGraphqlApiEnvironmentVariablesCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync env get',
    });

    const envCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof GetGraphqlApiEnvironmentVariablesCommand,
    );
    expect(envCall).toBeDefined();
    expect(envCall![0].input).toMatchInlineSnapshot(`
      Object {
        "apiId": "123456789",
      }
    `);
  });

  it('should log info when no environment variables are set', async () => {
    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({ environmentVariables: {} }); // GetGraphqlApiEnvironmentVariablesCommand

    const instance = plugin();
    (instance as any).options = {};

    // Manually wire getApiId to return a fixed ID
    jest.spyOn(instance, 'getApiId').mockResolvedValue('123456789');

    await instance.envGet();

    expect((instance as any).utils.log.info).toHaveBeenCalledWith(
      'No environment variables set for this API.',
    );
  });
});

describe('env set', () => {
  it('should set an environment variable (merging with existing)', async () => {
    mockSend
      .mockResolvedValueOnce(describeStackResourcesResponse) // DescribeStackResourcesCommand
      .mockResolvedValueOnce({
        environmentVariables: { EXISTING_KEY: 'existing-value' },
      }) // GetGraphqlApiEnvironmentVariablesCommand
      .mockResolvedValueOnce({}); // PutGraphqlApiEnvironmentVariablesCommand

    await runServerless({
      fixture: 'appsync',
      command: 'appsync env set',
      options: { key: 'NEW_KEY', value: 'new-value' },
    });

    const putCall = mockSend.mock.calls.find(
      ([cmd]) => cmd instanceof PutGraphqlApiEnvironmentVariablesCommand,
    );
    expect(putCall).toBeDefined();
    expect(putCall![0].input).toMatchInlineSnapshot(`
      Object {
        "apiId": "123456789",
        "environmentVariables": Object {
          "EXISTING_KEY": "existing-value",
          "NEW_KEY": "new-value",
        },
      }
    `);
  });

  it('should throw when --key or --value is missing', async () => {
    const instance = plugin();
    (instance as any).options = { key: 'ONLY_KEY' };

    await expect(instance.envSet()).rejects.toThrow(
      'You must specify both --key and --value.',
    );
  });
});

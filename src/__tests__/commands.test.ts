import { runServerless } from './utils';
import * as utils from '../utils';
import ServerlessError from 'serverless/lib/serverless-error';

jest.setTimeout(30000);

const confirmSpy = jest.spyOn(utils, 'confirmAction');
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
  confirmSpy.mockClear();
});

describe('create domain', () => {
  const createDomainName = jest.fn();
  const listCertificates = jest.fn();
  afterEach(() => {
    createDomainName.mockClear();
    listCertificates.mockClear();
  });
  it('should create a domain with specified certificate ARN', async () => {
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        AppSync: {
          createDomainName,
        },
        ACM: {
          listCertificates,
        },
      },
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

    expect(createDomainName).toHaveBeenCalledTimes(1);
    expect(listCertificates).not.toHaveBeenCalled();
    expect(createDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493",
                "domainName": "api.example.com",
              }
          `);
  });

  it('should create a domain and find a matching certificate, exact match', async () => {
    listCertificates.mockResolvedValueOnce({
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

    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        AppSync: {
          createDomainName,
        },
        ACM: {
          listCertificates,
        },
      },
      command: 'appsync domain create',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(listCertificates).toHaveBeenCalledTimes(1);
    expect(listCertificates.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "CertificateStatuses": Array [
          "ISSUED",
        ],
      }
    `);
    expect(createDomainName).toHaveBeenCalledTimes(1);
    expect(createDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/8acd9c69-1704-462c-be91-b5d7ce45c493",
        "domainName": "api.example.com",
      }
    `);
  });

  it('should fail creating a domain if ARN cannot be resolved', async () => {
    listCertificates.mockResolvedValueOnce({
      CertificateSummaryList: [
        {
          DomainName: 'foo.example.com',
          CertificateArn:
            'arn:aws:acm:us-east-1:123456789012:certificate/932b56de-bb63-45fe-8a31-b3150fb9accd',
        },
      ],
    });

    await expect(
      runServerless({
        fixture: 'appsync',
        awsRequestStubMap: {
          AppSync: {
            createDomainName,
          },

          ACM: {
            listCertificates,
          },
        },

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

    expect(listCertificates).toHaveBeenCalledTimes(1);
    expect(listCertificates.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "CertificateStatuses": Array [
          "ISSUED",
        ],
      }
    `);
    expect(createDomainName).not.toHaveBeenCalled();
  });

  it('should create a domain and find a matching certificate, wildcard match', async () => {
    listCertificates.mockResolvedValueOnce({
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

    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        AppSync: {
          createDomainName,
        },
        ACM: {
          listCertificates,
        },
      },
      command: 'appsync domain create',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(listCertificates).toHaveBeenCalledTimes(1);
    expect(listCertificates.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "CertificateStatuses": Array [
          "ISSUED",
        ],
      }
    `);
    expect(createDomainName).toHaveBeenCalledTimes(1);
    expect(createDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/fd8f67f7-bf19-4894-80db-0c49bf5dd507",
        "domainName": "api.example.com",
      }
    `);
  });
});

describe('delete domain', () => {
  const deleteDomainName = jest.fn();
  afterEach(() => {
    deleteDomainName.mockClear();
  });
  it('should delete a domain, asking for confirmation', async () => {
    confirmSpy.mockResolvedValue(true);

    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        AppSync: {
          deleteDomainName,
        },
      },
      command: 'appsync domain delete',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(deleteDomainName).toHaveBeenCalledTimes(1);
    expect(deleteDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
        Object {
          "domainName": "api.example.com",
        }
      `);
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('should delete a domain, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);

    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        AppSync: {
          deleteDomainName,
        },
      },
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
    expect(deleteDomainName).toHaveBeenCalledTimes(1);
    expect(deleteDomainName.mock.calls[0][0]).toMatchInlineSnapshot(`
        Object {
          "domainName": "api.example.com",
        }
      `);
  });

  it('should not delete a domain, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);

    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        AppSync: {
          deleteDomainName,
        },
      },
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
    expect(deleteDomainName).not.toHaveBeenCalled();
  });
});

describe('assoc domain', () => {
  const associateApi = jest.fn();
  const getApiAssociation = jest.fn();

  afterEach(() => {
    associateApi.mockClear();
    getApiAssociation.mockReset();
  });

  it('should associate a domain', async () => {
    getApiAssociation
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
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { associateApi, getApiAssociation },
      },
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(2);
    expect(associateApi).toHaveBeenCalledTimes(1);
    expect(getApiAssociation.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
      ]
    `);
    expect(associateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "apiId": "123456789",
                "domainName": "api.example.com",
              }
          `);
  });

  it('should handle already associated APIs', async () => {
    getApiAssociation.mockResolvedValueOnce({
      apiAssociation: {
        apiId: '123456789',
        associationStatus: 'SUCCESS',
      },
    });
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { associateApi, getApiAssociation },
      },
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(1);
    expect(associateApi).not.toHaveBeenCalled();
    expect(getApiAssociation.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
      ]
    `);
  });

  it('should ask for confirmation when already associated', async () => {
    confirmSpy.mockResolvedValue(true);

    getApiAssociation
      .mockResolvedValueOnce({
        apiAssociation: {
          apiId: '987654321',
          associationStatus: 'SUCCESS',
        },
      })
      .mockResolvedValue({
        apiAssociation: {
          apiId: '123456789',
          associationStatus: 'SUCCESS',
        },
      });
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { associateApi, getApiAssociation },
      },
      command: 'appsync domain assoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(2);
    expect(associateApi).toHaveBeenCalledTimes(1);
    expect(getApiAssociation.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
      ]
    `);
    expect(associateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "apiId": "123456789",
                "domainName": "api.example.com",
              }
          `);
  });

  it('should not ask for confirmation when yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);
    getApiAssociation
      .mockResolvedValueOnce({
        apiAssociation: {
          apiId: '987654321',
          associationStatus: 'SUCCESS',
        },
      })
      .mockResolvedValue({
        apiAssociation: {
          apiId: '123456789',
          associationStatus: 'SUCCESS',
        },
      });
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { associateApi, getApiAssociation },
      },
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

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(2);
    expect(associateApi).toHaveBeenCalledTimes(1);
    expect(getApiAssociation.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
      ]
    `);
    expect(associateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "apiId": "123456789",
                "domainName": "api.example.com",
              }
          `);
  });
});

describe('domain disassoc', () => {
  const disassociateApi = jest.fn();
  const getApiAssociation = jest.fn();

  afterEach(() => {
    disassociateApi.mockClear();
    getApiAssociation.mockReset();
  });

  it('should disassociate a domain, asking for confirmation ', async () => {
    confirmSpy.mockResolvedValue(true);
    getApiAssociation
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
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { disassociateApi, getApiAssociation },
      },
      command: 'appsync domain disassoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(2);
    expect(disassociateApi).toHaveBeenCalledTimes(1);
    expect(getApiAssociation.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
      ]
    `);
    expect(disassociateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
  });

  it('should disassociate a domain, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);
    getApiAssociation
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
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { disassociateApi, getApiAssociation },
      },
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

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(2);
    expect(disassociateApi).toHaveBeenCalledTimes(1);
    expect(getApiAssociation.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ],
      ]
    `);
    expect(disassociateApi.mock.calls[0][0]).toMatchInlineSnapshot(`
              Object {
                "domainName": "api.example.com",
              }
          `);
  });

  it('should not disassociate a domain, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);
    getApiAssociation.mockResolvedValueOnce({
      apiAssociation: {
        apiId: '123456789',
        associationStatus: 'SUCCESS',
      },
    });
    await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { disassociateApi, getApiAssociation },
      },
      command: 'appsync domain disassoc',
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(describeStackResources).toHaveBeenCalledTimes(1);
    expect(getApiAssociation).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalled();
    expect(disassociateApi).not.toHaveBeenCalled();
  });
});

describe('domain create-record', () => {
  const getDomainName = jest.fn();
  const listHostedZonesByName = jest.fn();
  const changeResourceRecordSets = jest.fn();
  const getChange = jest.fn();

  beforeEach(() => {
    getDomainName.mockResolvedValue({
      domainNameConfig: {
        appsyncDomainName: 'qbcdefghij.cloudfront.net',
        hostedZoneId: 'Z111111QQQQQQQ',
      },
    });
    listHostedZonesByName.mockResolvedValue({
      HostedZones: [
        {
          Id: '/hostedzone/KLMNOP',
          Name: 'example.com.',
        },
      ],
    });
    changeResourceRecordSets.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'PENDING',
      },
    });
    getChange.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'INSYNC',
      },
    });
  });

  afterEach(() => {
    getDomainName.mockClear();
    listHostedZonesByName.mockClear();
    changeResourceRecordSets.mockClear();
    getChange.mockClear();
  });

  it('should create a route53 record', async () => {
    await runServerless({
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
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
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
  });

  it('should handle changeResourceRecordSets errors', async () => {
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to create resource record set [name='api.example.com.', type='A'] but it already exists]",
      ),
    );

    await expect(
      runServerless({
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

    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
  });

  it('should handle changeResourceRecordSets errors silently', async () => {
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to create resource record set [name='api.example.com.', type='A'] but it already exists]",
      ),
    );

    await runServerless({
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
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: { quiet: true },
    });

    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
  });

  it('should handle when appsync domain name not created', async () => {
    getDomainName.mockResolvedValue(new ServerlessError('Domain not found'));

    await expect(
      runServerless({
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

    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).not.toHaveBeenCalled();
    expect(changeResourceRecordSets).not.toHaveBeenCalled();
    expect(getChange).not.toHaveBeenCalled();
  });
});

describe('domain delete-record', () => {
  const getDomainName = jest.fn().mockResolvedValue({
    domainNameConfig: {
      appsyncDomainName: 'qbcdefghij.cloudfront.net',
      hostedZoneId: 'Z111111QQQQQQQ',
    },
  });
  const listHostedZonesByName = jest.fn().mockResolvedValue({
    HostedZones: [
      {
        Id: '/hostedzone/KLMNOP',
        Name: 'example.com.',
      },
    ],
  });
  const changeResourceRecordSets = jest.fn();
  const getChange = jest.fn().mockResolvedValue({
    ChangeInfo: {
      Id: '1234567890',
      Status: 'INSYNC',
    },
  });

  afterEach(() => {
    getDomainName.mockClear();
    listHostedZonesByName.mockClear();
    changeResourceRecordSets.mockClear();
    getChange.mockClear();
  });

  it('should delete a route53 record, asking for confirmation', async () => {
    confirmSpy.mockResolvedValue(true);
    changeResourceRecordSets.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'PENDING',
      },
    });

    await runServerless({
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
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
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
  });

  it('should not delete a route53 record, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);
    changeResourceRecordSets.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'PENDING',
      },
    });

    await runServerless({
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
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).not.toHaveBeenCalled();
    expect(getChange).not.toHaveBeenCalled();
    expect(getDomainName.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          Object {
            "domainName": "api.example.com",
          },
        ]
      `);
  });

  it('should delete a route53 record, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);
    changeResourceRecordSets.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'PENDING',
      },
    });

    await runServerless({
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
      configExt: {
        appSync: {
          domain: {
            useCloudFormation: false,
          },
        },
      },
      options: { yes: true },
    });

    expect(confirmSpy).not.toHaveBeenCalled();
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
  });

  it('should handle changeResourceRecordSets errors', async () => {
    confirmSpy.mockResolvedValue(true);
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to delete resource record set [name='api.example.com.', type='A'] but it was not found]",
      ),
    );

    await expect(
      runServerless({
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
    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
  });

  it('should handle changeResourceRecordSets errors silently', async () => {
    confirmSpy.mockResolvedValue(true);
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to delete resource record set [name='api.example.com.', type='A'] but it was not found]",
      ),
    );

    await runServerless({
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
    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
  });
});

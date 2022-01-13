import { runServerless } from './utils';
import stripAnsi from 'strip-ansi';
import * as utils from '../utils';
import { ServerlessError } from 'serverless/lib/classes/Error';

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
  afterEach(() => {
    createDomainName.mockClear();
  });
  it('should create a domain', async () => {
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });
});

describe('delete domain', () => {
  const deleteDomainName = jest.fn();
  afterEach(() => {
    deleteDomainName.mockClear();
  });
  it('should delete a domain, asking for confirmation', async () => {
    confirmSpy.mockResolvedValue(true);

    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should delete a domain, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);

    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should not delete a domain, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);

    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should handle already associated APIs', async () => {
    getApiAssociation.mockResolvedValueOnce({
      apiAssociation: {
        apiId: '123456789',
        associationStatus: 'SUCCESS',
      },
    });
    const { stdoutData } = await runServerless({
      fixture: 'appsync',
      awsRequestStubMap: {
        CloudFormation: { describeStackResources },
        AppSync: { associateApi, getApiAssociation },
      },
      command: 'appsync domain assoc',
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should not disassociate a domain, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);
    getApiAssociation.mockResolvedValueOnce({
      apiAssociation: {
        apiId: '123456789',
        associationStatus: 'SUCCESS',
      },
    });
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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
    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should handle changeResourceRecordSets errors', async () => {
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to create resource record set [name='api.example.com.', type='CNAME'] but it already exists]",
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
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"[Tried to create resource record set [name='api.example.com.', type='CNAME'] but it already exists]"`,
    );

    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
  });

  it('should handle changeResourceRecordSets errors silently', async () => {
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to create resource record set [name='api.example.com.', type='CNAME'] but it already exists]",
      ),
    );

    const { stdoutData } = await runServerless({
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
      options: { quiet: true },
    });

    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
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

    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should not delete a route53 record, when not confirmed', async () => {
    confirmSpy.mockResolvedValue(false);
    changeResourceRecordSets.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'PENDING',
      },
    });

    const { stdoutData } = await runServerless({
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

    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should delete a route53 record, skipping confirmation when the yes flag is passed', async () => {
    confirmSpy.mockResolvedValue(true);
    changeResourceRecordSets.mockResolvedValue({
      ChangeInfo: {
        Id: '1234567890',
        Status: 'PENDING',
      },
    });

    const { stdoutData } = await runServerless({
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
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });

  it('should handle changeResourceRecordSets errors', async () => {
    confirmSpy.mockResolvedValue(true);
    changeResourceRecordSets.mockRejectedValue(
      new ServerlessError(
        "[Tried to delete resource record set [name='api.example.com.', type='CNAME'] but it was not found]",
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
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"[Tried to delete resource record set [name='api.example.com.', type='CNAME'] but it was not found]"`,
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
        "[Tried to delete resource record set [name='api.example.com.', type='CNAME'] but it was not found]",
      ),
    );

    const { stdoutData } = await runServerless({
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
      options: {
        quiet: true,
      },
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(getDomainName).toHaveBeenCalledTimes(1);
    expect(listHostedZonesByName).toHaveBeenCalledTimes(1);
    expect(changeResourceRecordSets).toHaveBeenCalledTimes(1);
    expect(getChange).not.toHaveBeenCalled();
    expect(stripAnsi(stdoutData)).toMatchSnapshot();
  });
});

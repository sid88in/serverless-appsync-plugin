import fs from 'fs';
import os from 'os';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import * as given from './given';

const mockSend = jest.fn();
jest.mock('../aws-client-factory', () => ({
  AwsClientFactory: jest.fn().mockImplementation(() => ({
    getS3Client: () => ({ send: mockSend }),
  })),
}));

jest.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: jest.fn().mockReturnValue({}),
}));

const setup = () => {
  const plugin = given.plugin();
  const { serverless } = plugin;
  serverless.serviceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appsync-'));
  serverless.service.service = 'my-service';
  serverless.service.provider.deploymentBucket = 'my-bucket';
  serverless.service.provider.deploymentBucketObject = {
    serverSideEncryption: 'aws:kms',
    sseKMSKeyId: 'my-key',
    sseCustomerKey: 'my-customer-key',
  } as typeof serverless.service.provider.deploymentBucketObject;
  serverless.configurationInput.appSync = given.appSyncConfig({
    schema: [
      path.resolve('src/__tests__/fixtures/schemas/reserved/schema.graphql'),
    ],
    uploadSchemaToS3: true,
  });
  plugin.loadConfig();
  plugin.buildAndAppendResources();
  return { plugin };
};

afterEach(() => {
  mockSend.mockReset();
});

describe('uploadSchemaToS3', () => {
  it('uploads the packaged schema to the key the template references', async () => {
    const { plugin } = setup();
    plugin.writeSchemaFile();
    await plugin.uploadSchema();

    const location = plugin.serverless.service.resources?.Resources
      ?.GraphQlSchema.Properties?.DefinitionS3Location as {
      'Fn::Join': [string, unknown[]];
    };
    const [command] = mockSend.mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'my-bucket',
      Key: location['Fn::Join'][1][3],
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'my-key',
    });
    expect(command.input).not.toHaveProperty('SSECustomerKey');
    expect(command.input.Body).toContain('type Account');
  });

  it('fails when the packaged schema is missing', async () => {
    const { plugin } = setup();

    await expect(plugin.uploadSchema()).rejects.toThrow(
      /appsync-schema\.graphql is missing/,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });
});

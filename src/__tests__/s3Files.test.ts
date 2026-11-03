import fs from 'fs';
import os from 'os';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Api } from '../resources/Api';
import { IntrinsicFunction } from '../types/cloudFormation';
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
    uploadCodeToS3: true,
    // A pipeline resolver without code gets the default JS code.
    resolvers: {
      'Query.getAccount': {
        type: 'Query',
        field: 'getAccount',
        kind: 'PIPELINE',
        functions: [],
      },
    },
  });
  plugin.loadConfig();
  plugin.buildAndAppendResources();
  return { plugin };
};

// The S3 key is the last part of the Fn::Join of each location.
const templateKeys = (plugin: ReturnType<typeof setup>['plugin']) =>
  Object.values(plugin.serverless.service.resources?.Resources ?? {}).flatMap(
    (resource) => {
      const { DefinitionS3Location, CodeS3Location } =
        (resource as { Properties?: Record<string, unknown> }).Properties ?? {};
      return [DefinitionS3Location, CodeS3Location]
        .filter(Boolean)
        .map((location) => {
          const parts = (location as { 'Fn::Join': [string, string[]] })[
            'Fn::Join'
          ][1];
          return parts[parts.length - 1];
        });
    },
  );

afterEach(() => {
  mockSend.mockReset();
});

describe('S3 files', () => {
  it('uploads every file the template references', async () => {
    const { plugin } = setup();
    plugin.writeS3Files();
    await plugin.uploadS3Files();

    const inputs = mockSend.mock.calls.map(([command]) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      return command.input;
    });
    const keys = templateKeys(plugin);
    expect(keys).toHaveLength(2);
    expect(inputs.map((input) => input.Key).sort()).toEqual(keys.sort());
    for (const input of inputs) {
      expect(input).toMatchObject({
        Bucket: 'my-bucket',
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: 'my-key',
      });
      // CloudFormation cannot read an SSE-C object.
      expect(input).not.toHaveProperty('SSECustomerKey');
    }
  });

  it('fails when the packaged files are missing', async () => {
    const { plugin } = setup();

    await expect(plugin.uploadS3Files()).rejects.toThrow(
      /AppSync files directory .* is missing/,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('keeps code with substitutions in the template', () => {
    const api = new Api(
      given.appSyncConfig({ uploadCodeToS3: true }),
      given.plugin(),
    );
    const code: IntrinsicFunction = {
      'Fn::Join': ['', ['const a = ', { Ref: 'Foo' }]],
    };

    expect(api.getCodeProperties(code)).toEqual({ Code: code });
    expect(api.s3Files).toEqual({});
  });
});

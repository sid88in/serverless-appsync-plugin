import { AppSyncClient } from '@aws-sdk/client-appsync';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ACMClient } from '@aws-sdk/client-acm';
import { AwsClientFactory, AwsCredentials } from '../aws-client-factory';

jest.mock('@aws-sdk/client-appsync');
jest.mock('@aws-sdk/client-cloudformation');
jest.mock('@aws-sdk/client-cloudwatch-logs');
jest.mock('@aws-sdk/client-route-53');
jest.mock('@aws-sdk/client-acm');

const mockAppSyncClient = AppSyncClient as jest.MockedClass<
  typeof AppSyncClient
>;
const mockCloudFormationClient = CloudFormationClient as jest.MockedClass<
  typeof CloudFormationClient
>;
const mockCloudWatchLogsClient = CloudWatchLogsClient as jest.MockedClass<
  typeof CloudWatchLogsClient
>;
const mockRoute53Client = Route53Client as jest.MockedClass<
  typeof Route53Client
>;
const mockAcmClient = ACMClient as jest.MockedClass<typeof ACMClient>;

const TEST_REGION = 'eu-west-1';
const TEST_CREDENTIALS: AwsCredentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  sessionToken: 'test-session-token',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AwsClientFactory', () => {
  describe('region configuration', () => {
    it('creates AppSyncClient with the region passed to the constructor', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getAppSyncClient();
      expect(mockAppSyncClient).toHaveBeenCalledWith(
        expect.objectContaining({ region: TEST_REGION }),
      );
    });

    it('creates CloudFormationClient with the region passed to the constructor', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getCloudFormationClient();
      expect(mockCloudFormationClient).toHaveBeenCalledWith(
        expect.objectContaining({ region: TEST_REGION }),
      );
    });

    it('creates CloudWatchLogsClient with the region passed to the constructor', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getCloudWatchLogsClient();
      expect(mockCloudWatchLogsClient).toHaveBeenCalledWith(
        expect.objectContaining({ region: TEST_REGION }),
      );
    });

    it('creates Route53Client with the region passed to the constructor', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getRoute53Client();
      expect(mockRoute53Client).toHaveBeenCalledWith(
        expect.objectContaining({ region: TEST_REGION }),
      );
    });

    it('creates ACMClient with us-east-1 regardless of the region passed to the constructor', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getAcmClient();
      expect(mockAcmClient).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'us-east-1' }),
      );
    });

    it('does not pass the constructor region to ACMClient', () => {
      const factory = new AwsClientFactory('ap-southeast-1', TEST_CREDENTIALS);
      factory.getAcmClient();
      expect(mockAcmClient).not.toHaveBeenCalledWith(
        expect.objectContaining({ region: 'ap-southeast-1' }),
      );
    });
  });

  describe('lazy initialization', () => {
    it('returns the same AppSyncClient instance on repeated calls', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      const first = factory.getAppSyncClient();
      const second = factory.getAppSyncClient();
      expect(first).toBe(second);
      expect(mockAppSyncClient).toHaveBeenCalledTimes(1);
    });

    it('returns the same CloudFormationClient instance on repeated calls', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      const first = factory.getCloudFormationClient();
      const second = factory.getCloudFormationClient();
      expect(first).toBe(second);
      expect(mockCloudFormationClient).toHaveBeenCalledTimes(1);
    });

    it('returns the same CloudWatchLogsClient instance on repeated calls', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      const first = factory.getCloudWatchLogsClient();
      const second = factory.getCloudWatchLogsClient();
      expect(first).toBe(second);
      expect(mockCloudWatchLogsClient).toHaveBeenCalledTimes(1);
    });

    it('returns the same Route53Client instance on repeated calls', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      const first = factory.getRoute53Client();
      const second = factory.getRoute53Client();
      expect(first).toBe(second);
      expect(mockRoute53Client).toHaveBeenCalledTimes(1);
    });

    it('returns the same ACMClient instance on repeated calls', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      const first = factory.getAcmClient();
      const second = factory.getAcmClient();
      expect(first).toBe(second);
      expect(mockAcmClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('credentials forwarding', () => {
    it('passes static credentials to AppSyncClient', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getAppSyncClient();
      expect(mockAppSyncClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: TEST_CREDENTIALS }),
      );
    });

    it('passes static credentials to CloudFormationClient', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getCloudFormationClient();
      expect(mockCloudFormationClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: TEST_CREDENTIALS }),
      );
    });

    it('passes static credentials to CloudWatchLogsClient', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getCloudWatchLogsClient();
      expect(mockCloudWatchLogsClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: TEST_CREDENTIALS }),
      );
    });

    it('passes static credentials to Route53Client', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getRoute53Client();
      expect(mockRoute53Client).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: TEST_CREDENTIALS }),
      );
    });

    it('passes static credentials to ACMClient', () => {
      const factory = new AwsClientFactory(TEST_REGION, TEST_CREDENTIALS);
      factory.getAcmClient();
      expect(mockAcmClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: TEST_CREDENTIALS }),
      );
    });

    it('passes a CredentialProvider function to all clients', () => {
      const credentialProvider = jest.fn();
      const factory = new AwsClientFactory(TEST_REGION, credentialProvider);

      factory.getAppSyncClient();
      factory.getCloudFormationClient();
      factory.getCloudWatchLogsClient();
      factory.getRoute53Client();
      factory.getAcmClient();

      expect(mockAppSyncClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: credentialProvider }),
      );
      expect(mockCloudFormationClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: credentialProvider }),
      );
      expect(mockCloudWatchLogsClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: credentialProvider }),
      );
      expect(mockRoute53Client).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: credentialProvider }),
      );
      expect(mockAcmClient).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: credentialProvider }),
      );
    });
  });
});

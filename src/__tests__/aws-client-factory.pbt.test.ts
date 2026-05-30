/**
 * Property-based tests for AwsClientFactory (Properties 1 & 2).
 * Tests the real AwsClientFactory with mocked SDK clients.
 *
 * Feature: aws-sdk-v3-migration
 */

import * as fc from 'fast-check';
import { AppSyncClient } from '@aws-sdk/client-appsync';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ACMClient } from '@aws-sdk/client-acm';
import { AwsClientFactory, AwsCredentials } from '../aws-client-factory';

// Mock the SDK clients so no real AWS calls are made.
// The real AwsClientFactory is NOT mocked — we test it directly.
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

const STATIC_CREDENTIALS: AwsCredentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Property 1: Region propagation to SDK v3 clients
// Feature: aws-sdk-v3-migration, Property 1: Region propagation to SDK v3 clients
// ---------------------------------------------------------------------------
describe('Property 1: Region propagation to SDK v3 clients', () => {
  it('AppSyncClient is constructed with the exact region passed to AwsClientFactory', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (region) => {
        jest.clearAllMocks();
        const factory = new AwsClientFactory(region, STATIC_CREDENTIALS);
        factory.getAppSyncClient();
        expect(mockAppSyncClient).toHaveBeenCalledWith(
          expect.objectContaining({ region }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('CloudFormationClient is constructed with the exact region passed to AwsClientFactory', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (region) => {
        jest.clearAllMocks();
        const factory = new AwsClientFactory(region, STATIC_CREDENTIALS);
        factory.getCloudFormationClient();
        expect(mockCloudFormationClient).toHaveBeenCalledWith(
          expect.objectContaining({ region }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('CloudWatchLogsClient is constructed with the exact region passed to AwsClientFactory', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (region) => {
        jest.clearAllMocks();
        const factory = new AwsClientFactory(region, STATIC_CREDENTIALS);
        factory.getCloudWatchLogsClient();
        expect(mockCloudWatchLogsClient).toHaveBeenCalledWith(
          expect.objectContaining({ region }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Route53Client is constructed with the exact region passed to AwsClientFactory', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (region) => {
        jest.clearAllMocks();
        const factory = new AwsClientFactory(region, STATIC_CREDENTIALS);
        factory.getRoute53Client();
        expect(mockRoute53Client).toHaveBeenCalledWith(
          expect.objectContaining({ region }),
        );
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: ACM client always uses us-east-1
// Feature: aws-sdk-v3-migration, Property 2: ACM client always uses us-east-1
// ---------------------------------------------------------------------------
describe('Property 2: ACM client always uses us-east-1', () => {
  it('ACMClient is always constructed with us-east-1 regardless of the region passed to AwsClientFactory', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (region) => {
        jest.clearAllMocks();
        const factory = new AwsClientFactory(region, STATIC_CREDENTIALS);
        factory.getAcmClient();
        expect(mockAcmClient).toHaveBeenCalledWith(
          expect.objectContaining({ region: 'us-east-1' }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('ACMClient is never constructed with the region passed to AwsClientFactory when it differs from us-east-1', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((r) => r !== 'us-east-1'),
        (region) => {
          jest.clearAllMocks();
          const factory = new AwsClientFactory(region, STATIC_CREDENTIALS);
          factory.getAcmClient();
          expect(mockAcmClient).not.toHaveBeenCalledWith(
            expect.objectContaining({ region }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Introspection schema Uint8Array round-trip
// Feature: aws-sdk-v3-migration, Property 5: Introspection schema Uint8Array round-trip
// ---------------------------------------------------------------------------
describe('Property 5: Introspection schema Uint8Array round-trip', () => {
  it('Buffer.from(schema).toString() returns the original schema string unchanged', () => {
    fc.assert(
      fc.property(fc.string(), (schema) => {
        const roundTripped = Buffer.from(schema).toString();
        expect(roundTripped).toBe(schema);
      }),
      { numRuns: 100 },
    );
  });

  it('TextDecoder.decode(Buffer.from(schema)) returns the original schema string unchanged', () => {
    fc.assert(
      fc.property(fc.string(), (schema) => {
        const decoded = new TextDecoder().decode(Buffer.from(schema));
        expect(decoded).toBe(schema);
      }),
      { numRuns: 100 },
    );
  });
});

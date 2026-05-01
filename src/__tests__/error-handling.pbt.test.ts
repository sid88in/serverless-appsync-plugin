/**
 * Property-based tests for error handling in ServerlessAppsyncPlugin (Properties 3 & 4).
 * Tests getApiAssocStatus() with a mocked AwsClientFactory.
 *
 * Feature: aws-sdk-v3-migration
 */

import * as fc from 'fast-check';
import { plugin } from './given';

// Mock AwsClientFactory so no real AWS credentials or SDK calls are made.
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

// Avoid ESM dynamic import issues with credential-providers in Jest
jest.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: jest.fn().mockReturnValue({}),
}));

beforeEach(() => {
  mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Property 3: NotFoundException is mapped to NOT_FOUND association status
// Feature: aws-sdk-v3-migration, Property 3: NotFoundException is mapped to NOT_FOUND association status
// ---------------------------------------------------------------------------
describe('Property 3: NotFoundException is mapped to NOT_FOUND association status', () => {
  it('getApiAssocStatus returns { associationStatus: NOT_FOUND } for any domain name when NotFoundException is thrown', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (domainName) => {
        const notFoundError = Object.assign(new Error('Domain not found'), {
          name: 'NotFoundException',
        });
        mockSend.mockRejectedValue(notFoundError);

        const p = plugin();
        const result = await p.getApiAssocStatus(domainName);

        expect(result).toEqual({ associationStatus: 'NOT_FOUND' });
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Unexpected errors are re-thrown unchanged
// Feature: aws-sdk-v3-migration, Property 4: Unexpected errors are re-thrown unchanged
// ---------------------------------------------------------------------------
describe('Property 4: Unexpected errors are re-thrown unchanged', () => {
  it('getApiAssocStatus re-throws the original error when error.name is not NotFoundException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s !== 'NotFoundException'),
        async (errorName) => {
          const unexpectedError = Object.assign(
            new Error('Unexpected failure'),
            {
              name: errorName,
            },
          );
          mockSend.mockRejectedValue(unexpectedError);

          const p = plugin();
          await expect(p.getApiAssocStatus('some-domain')).rejects.toThrow(
            unexpectedError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('re-thrown error is the exact same object reference (not a wrapped copy)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s !== 'NotFoundException'),
        async (errorName) => {
          const originalError = Object.assign(new Error('Original error'), {
            name: errorName,
          });
          mockSend.mockRejectedValue(originalError);

          const p = plugin();
          let caughtError: unknown;
          try {
            await p.getApiAssocStatus('some-domain');
          } catch (e) {
            caughtError = e;
          }

          expect(caughtError).toBe(originalError);
        },
      ),
      { numRuns: 100 },
    );
  });
});

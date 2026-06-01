import type { Config } from '@jest/types';

/**
 * Jest config for the OPT-IN live AWS integration suite.
 *
 * This is intentionally separate from jest.config.ts (unit) and
 * jest.e2e.config.ts (offline CFN synthesis). It is only ever run via
 * `npm run test:integration` and is never part of `npm test`,
 * `npm run test:e2e`, `npm run test:all`, or the default CI.
 *
 * When APPSYNC_PLUGIN_INTEGRATION is unset, every suite resolves to
 * `describe.skip` (see integration/helpers/gate.ts) and this config exits 0.
 */
const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/integration/**/*.integration.test.ts'],
  // Live AWS calls and eventual consistency: generous default, per-test
  // overrides for deploys.
  testTimeout: 300_000,
  globalSetup: './jest.integration.setup.ts',
  // Serialize: deploys are heavy and share an AWS account (and, in Tier D, a
  // single domain), so running them in parallel invites throttling/collisions.
  maxWorkers: 1,
  // Skipped-only runs (no credentials) must still exit green.
  passWithNoTests: true,
};

export default config;

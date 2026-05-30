import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.ts'],
  testTimeout: 60_000,
  globalSetup: './jest.e2e.setup.ts',
  // E2E tests synthesize CloudFormation by spawning the Serverless Framework
  // CLI. Keep concurrency modest so we don't overwhelm CI runners.
  maxWorkers: 2,
};

export default config;

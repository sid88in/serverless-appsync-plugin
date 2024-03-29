import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  globalSetup: './jest.setup.ts',
  testEnvironment: 'node',
  silent: true,
  moduleDirectories: ['node_modules', 'src'],
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|ts|tsx)$'],
};

export default config;

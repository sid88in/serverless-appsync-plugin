import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  testEnvironment: 'node',
  silent: true,
  moduleDirectories: ['node_modules', 'src'],
  transform: {
    '\\.ts$': 'esbuild-runner/jest',
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|ts|tsx)$'],
};

export default config;

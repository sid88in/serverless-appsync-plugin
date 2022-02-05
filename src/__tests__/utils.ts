import runServerlessFixtureEngine from '@serverless/test/setup-run-serverless-fixtures-engine';
import { merge } from 'lodash';
import path from 'path';
import Serverless from 'serverless/lib/Serverless';

type RunSlsOptions = {
  fixture: 'appsync';
  configExt?: Partial<Serverless['configurationInput']>;
  awsRequestStubMap?: Record<string, Record<string, jest.Mock>>;
  command: string;
  options?: Record<string, string | boolean>;
};

export const runServerless = (options: RunSlsOptions) => {
  return runServerlessFixtureEngine({
    fixturesDir: path.resolve(__dirname, 'fixtures'),
    serverlessDir: path.resolve(__dirname, '../../node_modules/serverless'),
  })(
    merge(
      {
        configExt: {
          plugins: [path.resolve(__dirname, '../../src/index.ts')],
        },
      },
      options,
    ),
  );
};

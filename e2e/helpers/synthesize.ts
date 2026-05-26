import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type CfnResource = {
  Type: string;
  Properties?: Record<string, unknown>;
  DependsOn?: string | string[];
  Condition?: string;
};

export type CfnTemplate = {
  AWSTemplateFormatVersion?: string;
  Description?: string;
  Resources: Record<string, CfnResource>;
  Outputs?: Record<string, { Value: unknown; Export?: { Name: unknown } }>;
  Parameters?: Record<string, unknown>;
  Conditions?: Record<string, unknown>;
  Mappings?: Record<string, unknown>;
};

export type SynthesizeResult = {
  template: CfnTemplate;
  /** Absolute path of the .serverless directory used by this synth. */
  packageDir: string;
  /** Cleanup function that removes the temporary package directory. */
  cleanup: () => void;
};

const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVERLESS_BIN = path.join(
  REPO_ROOT,
  'node_modules',
  '.bin',
  'serverless',
);

/**
 * Run `serverless package` against the example project at `exampleDir` and
 * return the synthesized CloudFormation template.
 *
 * The plugin path is rewritten on the fly so the example uses the source
 * code in this repository (not an installed version), which is what makes
 * these tests meaningful for development.
 *
 * The package output is written to a unique temp directory per call so
 * tests can run in parallel without colliding.
 */
export function synthesize(exampleDir: string): SynthesizeResult {
  const absoluteExampleDir = path.isAbsolute(exampleDir)
    ? exampleDir
    : path.join(REPO_ROOT, exampleDir);

  if (!fs.existsSync(absoluteExampleDir)) {
    throw new Error(`Example directory does not exist: ${absoluteExampleDir}`);
  }

  if (!fs.existsSync(SERVERLESS_BIN)) {
    throw new Error(
      `Serverless Framework binary not found at ${SERVERLESS_BIN}. ` +
        `Run \`npm ci\` at the repo root.`,
    );
  }

  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sls-appsync-e2e-'));

  try {
    execFileSync(SERVERLESS_BIN, ['package', '--package', packageDir], {
      cwd: absoluteExampleDir,
      env: {
        ...process.env,
        // Suppress framework prompts and analytics
        SLS_NOTIFICATIONS_MODE: 'off',
        SLS_INTERACTIVE_SETUP_ENABLE: '0',
        // Set a stable region so tests are deterministic
        AWS_REGION: 'us-east-1',
        AWS_DEFAULT_REGION: 'us-east-1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // Surface stderr in test output so failures are diagnosable
    const e = err as { stderr?: Buffer; stdout?: Buffer; message: string };
    const stderr = e.stderr?.toString() ?? '';
    const stdout = e.stdout?.toString() ?? '';
    fs.rmSync(packageDir, { recursive: true, force: true });
    throw new Error(
      `serverless package failed for ${absoluteExampleDir}:\n` +
        `STDOUT:\n${stdout}\n` +
        `STDERR:\n${stderr}\n` +
        `MESSAGE: ${e.message}`,
    );
  }

  const templatePath = path.join(
    packageDir,
    'cloudformation-template-update-stack.json',
  );
  if (!fs.existsSync(templatePath)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
    throw new Error(
      `CloudFormation template was not produced at ${templatePath}.`,
    );
  }

  const template = JSON.parse(
    fs.readFileSync(templatePath, 'utf8'),
  ) as CfnTemplate;

  return {
    template,
    packageDir,
    cleanup: () => {
      try {
        fs.rmSync(packageDir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

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

  // Serverless v4's `package` resolves a deployment bucket and, when none is
  // configured, calls getOrCreateDefaultBucket() — which reads/writes a shared
  // SSM parameter on AWS. That makes `package` require AWS connectivity and
  // race across parallel workers (`TooManyUpdates` on the shared parameter).
  // Setting `provider.deploymentBucket` short-circuits that path
  // (getServerlessDeploymentBucketName() returns early, before any AWS call),
  // keeping synthesis fully offline and deterministic. We inject it into a
  // temporary config copy via `--config` so the committed examples stay clean
  // and deployable.
  const baseConfig = fs.readFileSync(
    path.join(absoluteExampleDir, 'serverless.yml'),
    'utf8',
  );
  if (!/^provider:[ \t]*\n/m.test(baseConfig)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
    throw new Error(
      `Expected a block-style "provider:" in ${absoluteExampleDir}/serverless.yml ` +
        `to inject a deploymentBucket for offline synthesis.`,
    );
  }
  const e2eConfigName = 'serverless.e2e.yml';
  const e2eConfigPath = path.join(absoluteExampleDir, e2eConfigName);
  fs.writeFileSync(
    e2eConfigPath,
    baseConfig.replace(
      /^(provider:[ \t]*\n)/m,
      '$1  deploymentBucket: serverless-appsync-e2e\n',
    ),
  );

  try {
    execFileSync(
      SERVERLESS_BIN,
      ['package', '--config', e2eConfigName, '--package', packageDir],
      {
        cwd: absoluteExampleDir,
        env: {
          ...process.env,
          // Suppress framework prompts and analytics
          SLS_NOTIFICATIONS_MODE: 'off',
          SLS_INTERACTIVE_SETUP_ENABLE: '0',
          // Stable region for deterministic output
          AWS_REGION: 'us-east-1',
          AWS_DEFAULT_REGION: 'us-east-1',
          // Dummy credential fallback so CI (no real creds) can satisfy v4's
          // credentials check. With deploymentBucket set above, `package` makes
          // no real AWS calls, so these are never used against AWS.
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? 'e2e-dummy',
          AWS_SECRET_ACCESS_KEY:
            process.env.AWS_SECRET_ACCESS_KEY ?? 'e2e-dummy',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
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
  } finally {
    fs.rmSync(e2eConfigPath, { force: true });
  }

  // Serverless writes the synthesized template as
  // `cloudformation-template-update-stack.json`. We look it up defensively
  // (preferring the canonical name, then falling back to any
  // `cloudformation-template-*-stack.json`) so the harness is resilient to
  // any path/name nuance across Serverless Framework major versions.
  const canonical = path.join(
    packageDir,
    'cloudformation-template-update-stack.json',
  );
  let templatePath = canonical;
  if (!fs.existsSync(templatePath)) {
    const fallback = fs
      .readdirSync(packageDir)
      .find(
        (f) =>
          /^cloudformation-template-.*-stack\.json$/.test(f) &&
          f.endsWith('.json'),
      );
    if (fallback) {
      templatePath = path.join(packageDir, fallback);
    }
  }
  if (!fs.existsSync(templatePath)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
    throw new Error(
      `CloudFormation template was not produced in ${packageDir} ` +
        `(expected ${canonical} or a cloudformation-template-*-stack.json).`,
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

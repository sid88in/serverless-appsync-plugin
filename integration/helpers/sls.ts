import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { integrationConfig } from './config';

const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * The Serverless binary used to run deploys and plugin commands. Override with
 * SERVERLESS_BIN to point the suite at a different install (e.g. a Serverless
 * v4 binary). Defaults to the v3 install in this repo's node_modules.
 *
 * NOTE (v4): v4 resolves credentials as SDK v3 objects and may require
 * SERVERLESS_ACCESS_KEY / a license and suppression of login prompts. The
 * wrappers below already disable telemetry/interactive setup; the
 * credential/region proof should be re-confirmed when running under v4.
 */
const SERVERLESS_BIN =
  process.env.SERVERLESS_BIN ||
  path.join(REPO_ROOT, 'node_modules', '.bin', 'serverless');

export type SlsResult = {
  stdout: string;
  stderr: string;
};

export class SlsCommandError extends Error {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;

  constructor(
    message: string,
    stdout: string,
    stderr: string,
    status: number | null,
  ) {
    super(message);
    this.name = 'SlsCommandError';
    this.stdout = stdout;
    this.stderr = stderr;
    this.status = status;
  }
}

export type RunOptions = {
  /** Working directory: the prepared service directory. */
  cwd: string;
  /** Region passed via --region. Defaults to the configured region. */
  region?: string;
  /** Profile passed via --aws-profile. Defaults to the configured profile. */
  profile?: string;
  /** Extra environment variables. */
  env?: Record<string, string>;
  /** Per-command timeout in milliseconds. */
  timeout?: number;
};

/**
 * Run an arbitrary `serverless ...` invocation. Throws {@link SlsCommandError}
 * on non-zero exit so tests can assert on failure modes (used by the negative
 * half of the credential/region proof).
 */
export function runServerless(args: string[], options: RunOptions): SlsResult {
  if (!fs.existsSync(SERVERLESS_BIN)) {
    throw new Error(
      `Serverless binary not found at ${SERVERLESS_BIN}. Run \`npm ci\` or set SERVERLESS_BIN.`,
    );
  }

  const region = options.region ?? integrationConfig.region;
  const profile = options.profile ?? integrationConfig.profile;

  const fullArgs = [...args, '--region', region];
  if (profile) {
    fullArgs.push('--aws-profile', profile);
  }

  try {
    const stdout = execFileSync(SERVERLESS_BIN, fullArgs, {
      cwd: options.cwd,
      timeout: options.timeout ?? 240_000,
      env: {
        ...process.env,
        SLS_NOTIFICATIONS_MODE: 'off',
        SLS_INTERACTIVE_SETUP_ENABLE: '0',
        SLS_TELEMETRY_DISABLED: '1',
        AWS_REGION: region,
        AWS_DEFAULT_REGION: region,
        ...options.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout: stdout.toString(), stderr: '' };
  } catch (err) {
    const e = err as {
      stdout?: Buffer;
      stderr?: Buffer;
      status?: number | null;
      message: string;
    };
    const stdout = e.stdout?.toString() ?? '';
    const stderr = e.stderr?.toString() ?? '';
    throw new SlsCommandError(
      `serverless ${fullArgs.join(' ')} failed:\n${stdout}\n${stderr}\n${
        e.message
      }`,
      stdout,
      stderr,
      e.status ?? null,
    );
  }
}

export const deploy = (options: RunOptions): SlsResult =>
  runServerless(['deploy'], { timeout: 600_000, ...options });

export const remove = (options: RunOptions): SlsResult =>
  runServerless(['remove'], { timeout: 600_000, ...options });

export const info = (options: RunOptions): SlsResult =>
  runServerless(['info'], options);

/** Run an `serverless appsync <subcommand>` plugin command. */
export const appsync = (subcommand: string[], options: RunOptions): SlsResult =>
  runServerless(['appsync', ...subcommand], options);

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TAG_KEY } from './run-id';

const REPO_ROOT = path.resolve(__dirname, '../..');

export type PreparedProject = {
  /** Absolute path of the temporary service directory. */
  dir: string;
  /** The Serverless service name (== run id). */
  service: string;
  /** Remove the temporary directory. Safe to call multiple times. */
  cleanup: () => void;
};

export type PrepareOptions = {
  runId: string;
  region: string;
  /** Enable AppSync caching (Tier C). */
  caching?: boolean;
  /** Custom-domain config for Tier D (CLI integration, not CloudFormation). */
  domain?: {
    name: string;
    hostedZoneId?: string;
    certificateArn?: string;
  };
};

/**
 * Build a minimal, deployable Serverless service in a fresh temp directory:
 *
 *   - API_KEY auth with a single default key      -> exercises ListApiKeys
 *   - a NONE data source + one JS (UNIT) resolver -> exercises EvaluateCode and
 *     keeps the deploy free of extra IAM roles
 *   - field logging enabled                       -> gives FilterLogEvents a
 *     real log group to read
 *   - tags including TAG_KEY: <runId>             -> lets the sweeper find it
 *
 * The source plugin is linked in via a `node_modules/serverless-appsync-plugin`
 * symlink pointing at the repo root (the same trick the offline e2e harness
 * uses), so the deploy exercises THIS working tree, not an installed version.
 */
export function prepareProject(options: PrepareOptions): PreparedProject {
  const { runId, region, caching, domain } = options;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sls-appsync-it-'));

  // Link the plugin source into the project's node_modules.
  const nodeModules = path.join(dir, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    REPO_ROOT,
    path.join(nodeModules, 'serverless-appsync-plugin'),
    'dir',
  );

  // GraphQL schema.
  fs.writeFileSync(
    path.join(dir, 'schema.graphql'),
    [
      'type Query {',
      '  hello(name: String): String',
      '}',
      '',
      'schema {',
      '  query: Query',
      '}',
      '',
    ].join('\n'),
  );

  // JS resolver used by the EvaluateCode path. Deterministic so assertions are
  // stable; references @aws-appsync/utils to mirror real resolvers (esbuild
  // marks it external).
  fs.mkdirSync(path.join(dir, 'resolvers'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'resolvers', 'hello.js'),
    [
      "import { util } from '@aws-appsync/utils';",
      '',
      'export function request(ctx) {',
      '  return { payload: { name: ctx.arguments.name, id: util.autoId() } };',
      '}',
      '',
      'export function response(ctx) {',
      '  return ctx.result;',
      '}',
      '',
    ].join('\n'),
  );

  const yaml = buildServerlessYaml({ runId, region, caching, domain });
  fs.writeFileSync(path.join(dir, 'serverless.yml'), yaml);

  return {
    dir,
    service: runId,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

function buildServerlessYaml(opts: {
  runId: string;
  region: string;
  caching?: boolean;
  domain?: { name: string; hostedZoneId?: string; certificateArn?: string };
}): string {
  const { runId, region, caching, domain } = opts;

  const lines: string[] = [
    `service: ${runId}`,
    '',
    'provider:',
    '  name: aws',
    '  runtime: nodejs22.x',
    `  region: ${region}`,
    '',
    'plugins:',
    '  - serverless-appsync-plugin',
    '',
    'appSync:',
    `  name: ${runId}`,
    '  authentication:',
    '    type: API_KEY',
    '  apiKeys:',
    '    - name: default',
    '  logging:',
    '    level: ERROR',
    '    retentionInDays: 1',
    '  tags:',
    `    ${TAG_KEY}: ${runId}`,
  ];

  if (caching) {
    lines.push(
      '  caching:',
      '    behavior: FULL_REQUEST_CACHING',
      '    type: SMALL',
      '    ttl: 60',
    );
  }

  if (domain) {
    lines.push(
      '  domain:',
      `    name: ${domain.name}`,
      '    useCloudFormation: false',
    );
    if (domain.hostedZoneId) {
      lines.push(`    hostedZoneId: ${domain.hostedZoneId}`);
    }
    if (domain.certificateArn) {
      lines.push(`    certificateArn: ${domain.certificateArn}`);
    }
  }

  lines.push(
    '  resolvers:',
    '    Query.hello:',
    '      kind: UNIT',
    '      dataSource: none_ds',
    '      code: ./resolvers/hello.js',
    '  dataSources:',
    '    none_ds:',
    '      type: NONE',
    '',
  );

  return lines.join('\n');
}

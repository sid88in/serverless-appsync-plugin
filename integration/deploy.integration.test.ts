/**
 * Tier B (minimal deploy): a trivial API_KEY + NONE-datasource API, deployed
 * once and torn down with `serverless remove`. Exercises the live commands that
 * need a real deployed API, plus the headline credential/region proof for #686.
 *
 *   - serverless info               -> ListApiKeys (+ GetGraphqlApi, DescribeStackResources)
 *   - appsync get-introspection     -> GetIntrospectionSchema
 *   - appsync env set / env get     -> Put/GetGraphqlApiEnvironmentVariables
 *   - appsync logs                  -> FilterLogEvents (CloudWatch Logs)
 *   - credential/region proof       -> live command honors provider region/profile
 *
 * Teardown runs in afterAll even if the body throws; everything is also tagged
 * with the run id so the standalone sweeper can recover a leak.
 */
import {
  integrationDescribe,
  integrationConfig,
  profileProofEnabled,
} from './helpers/gate';
import { generateRunId } from './helpers/run-id';
import { prepareProject, PreparedProject } from './helpers/project';
import {
  deploy,
  remove,
  info,
  appsync,
  runServerless,
  SlsCommandError,
} from './helpers/sls';
import { extractApiArn, parseArn } from './helpers/aws';

const DEPLOY_TIMEOUT = 900_000; // 15 min: a fresh AppSync API + key

integrationDescribe('integration / Tier B — deploy + live commands', () => {
  let project: PreparedProject;
  let runId: string;

  beforeAll(async () => {
    runId = generateRunId();
    project = prepareProject({ runId, region: integrationConfig.region });
    deploy({ cwd: project.dir });
  }, DEPLOY_TIMEOUT);

  afterAll(async () => {
    // Best-effort teardown; never let cleanup failure mask a test result.
    if (project) {
      try {
        remove({ cwd: project.dir });
      } catch {
        // Sweeper will catch anything left behind (resources are tagged).
      }
      project.cleanup();
    }
  }, DEPLOY_TIMEOUT);

  it('lists the API key via `serverless info` (ListApiKeys)', () => {
    const { stdout } = info({ cwd: project.dir });
    expect(stdout.toLowerCase()).toContain('appsync api keys');
  });

  it('fetches the introspection schema (GetIntrospectionSchema)', () => {
    const { stdout } = appsync(['get-introspection', '--format', 'SDL'], {
      cwd: project.dir,
    });
    expect(stdout).toContain('type Query');
  });

  it('sets and gets an env var (Put/GetGraphqlApiEnvironmentVariables)', () => {
    appsync(['env', 'set', '--key', 'FOO', '--value', 'bar'], {
      cwd: project.dir,
    });
    const { stdout } = appsync(['env', 'get'], { cwd: project.dir });
    expect(stdout).toContain('FOO=bar');
  });

  it('reads logs without error (FilterLogEvents)', () => {
    // The log group exists (logging is enabled in the fixture) but is likely
    // empty; the call must still succeed.
    expect(() => appsync(['logs'], { cwd: project.dir })).not.toThrow();
  });

  describe('credential/region proof (#686)', () => {
    // Read the deployed API ARN from `serverless info --verbose` (the fixture
    // exposes it as the IntegrationApiArn stack output). This runs in the
    // serverless child process, so it exercises real credential/region
    // resolution without an in-VM SDK client.
    const readApiArn = (): string => {
      const { stdout } = runServerless(['info', '--verbose'], {
        cwd: project.dir,
      });
      const arn = extractApiArn(stdout);
      if (!arn) {
        throw new Error(
          `Could not find an AppSync API ARN in info output:\n${stdout}`,
        );
      }
      return arn;
    };

    it('deployed the API under the configured region, not the default chain', () => {
      const arn = readApiArn();
      expect(parseArn(arn).region).toBe(integrationConfig.region);
    });

    it('a live command succeeds when pointed at the configured region', () => {
      // Uses the same resolved provider region/profile as the deploy.
      expect(() => appsync(['env', 'get'], { cwd: project.dir })).not.toThrow();
    });

    it('the same live command fails when pointed at a different region', () => {
      // Proves the live command's region comes from the resolved provider
      // (the --region we pass), not a hardcoded value or the default chain:
      // the API does not exist in `otherRegion`, so the command errors.
      let thrown: unknown;
      try {
        appsync(['env', 'get'], {
          cwd: project.dir,
          region: integrationConfig.otherRegion,
        });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      const e = thrown as Partial<SlsCommandError> & { message?: string };
      const text = `${e.stdout ?? ''}\n${e.stderr ?? ''}\n${e.message ?? ''}`;
      expect(text).toMatch(
        /does not exist|not found|no api|could not|unable|no stack/i,
      );
    });

    (profileProofEnabled ? it : it.skip)(
      'deployed under the account tied to the configured profile',
      () => {
        const { accountId } = parseArn(readApiArn());
        expect(accountId).toMatch(/^\d{12}$/);
        if (integrationConfig.expectedAccountId) {
          expect(accountId).toBe(integrationConfig.expectedAccountId);
        }
      },
    );
  });
});

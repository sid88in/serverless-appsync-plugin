/**
 * Tier C (caching): caching is billed by the hour, so it is gated behind its
 * own flag (APPSYNC_PLUGIN_INTEGRATION_CACHING=1) on top of the master switch.
 * Deploys an API with FULL_REQUEST_CACHING, flushes the cache, then removes.
 *
 *   - appsync flush-cache -> FlushApiCacheCommand
 */
import { cachingDescribe, integrationConfig } from './helpers/gate';
import { generateRunId } from './helpers/run-id';
import { prepareProject, PreparedProject } from './helpers/project';
import { deploy, remove, appsync } from './helpers/sls';

const DEPLOY_TIMEOUT = 1_200_000; // caching clusters take longer to provision

cachingDescribe('integration / Tier C — caching (flush-cache)', () => {
  let project: PreparedProject;

  beforeAll(async () => {
    project = prepareProject({
      runId: generateRunId(),
      region: integrationConfig.region,
      caching: true,
    });
    deploy({ cwd: project.dir });
  }, DEPLOY_TIMEOUT);

  afterAll(async () => {
    if (project) {
      try {
        remove({ cwd: project.dir });
      } catch {
        // sweeper backstop
      }
      project.cleanup();
    }
  }, DEPLOY_TIMEOUT);

  it('flushes the cache (FlushApiCache)', () => {
    const { stdout } = appsync(['flush-cache'], { cwd: project.dir });
    expect(stdout.toLowerCase()).toContain('cache flushed');
  });
});

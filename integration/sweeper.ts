/**
 * Standalone leaked-resource sweeper for the integration suite.
 *
 * Tests tear themselves down in afterAll, but runs can be interrupted (Ctrl-C,
 * CI timeout, crash). This script finds and deletes any resources tagged by the
 * suite and any CloudFormation stacks named with the run-id prefix, so leaks
 * don't accumulate cost. It is idempotent and safe to re-run.
 *
 * Usage:
 *   APPSYNC_PLUGIN_INTEGRATION=1 \
 *   APPSYNC_PLUGIN_INTEGRATION_REGION=us-west-2 \
 *   [APPSYNC_PLUGIN_INTEGRATION_PROFILE=my-sandbox] \
 *   npm run test:integration:sweep
 *
 * Add APPSYNC_PLUGIN_INTEGRATION_DOMAIN to also clean a leaked custom domain.
 */
import { integrationConfig } from './helpers/config';
import {
  findLeakedApis,
  deleteApi,
  findLeakedStacks,
  deleteStack,
  cleanupDomainName,
} from './helpers/aws';

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[sweeper] ${message}`);
}

async function main(): Promise<void> {
  if (process.env.APPSYNC_PLUGIN_INTEGRATION !== '1') {
    log('APPSYNC_PLUGIN_INTEGRATION is not set to 1 — refusing to sweep.');
    process.exitCode = 0;
    return;
  }

  const { region } = integrationConfig;
  log(
    `sweeping region ${region}` +
      (integrationConfig.profile
        ? ` (profile ${integrationConfig.profile})`
        : ''),
  );

  // 1. Tagged AppSync APIs.
  const apis = await findLeakedApis(region);
  if (apis.length === 0) {
    log('no leaked AppSync APIs found');
  }
  for (const api of apis) {
    log(`deleting AppSync API ${api.apiId} (${api.name ?? 'unnamed'})`);
    try {
      await deleteApi(region, api.apiId);
    } catch (err) {
      log(`  failed: ${(err as Error).message}`);
    }
  }

  // 2. Leaked custom domain (if one was configured for this environment).
  if (integrationConfig.domain.name) {
    log(`cleaning custom domain ${integrationConfig.domain.name}`);
    try {
      await cleanupDomainName(region, integrationConfig.domain.name);
    } catch (err) {
      log(`  failed: ${(err as Error).message}`);
    }
  }

  // 3. Prefixed CloudFormation stacks.
  const stacks = await findLeakedStacks(region);
  if (stacks.length === 0) {
    log('no leaked CloudFormation stacks found');
  }
  for (const name of stacks) {
    log(`deleting CloudFormation stack ${name}`);
    try {
      await deleteStack(region, name);
    } catch (err) {
      log(`  failed: ${(err as Error).message}`);
    }
  }

  log('done (stack deletions are asynchronous; verify in the console)');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

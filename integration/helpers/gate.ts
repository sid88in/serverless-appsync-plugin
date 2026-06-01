/**
 * Opt-in gating for the live AWS integration suite (Jest layer).
 *
 * These tests cost money and require real AWS credentials, so they must never
 * run as part of the default `npm test` / `npm run test:e2e` jobs or in normal
 * CI. The master switch is `APPSYNC_PLUGIN_INTEGRATION=1`; without it (and
 * without a usable region + credential signal) every suite resolves to
 * `describe.skip` and the run exits green with everything pending.
 *
 * Environment parsing lives in ./config (Jest-free, importable by the sweeper);
 * this module adds the `describe`/`describe.skip` wrappers and therefore must
 * only be imported from Jest test files.
 */
import {
  integrationConfig,
  masterEnabled,
  missingCredentialSignal,
  cachingEnabled,
  domainEnabled,
  profileProofEnabled,
} from './config';

export { integrationConfig, profileProofEnabled };

/**
 * `describe` when enabled, otherwise `describe.skip`. The reason is logged once
 * when the suite was explicitly requested (so a misconfigured environment is
 * easy to diagnose), while the default switched-off case stays quiet.
 */
function gatedDescribe(
  enabled: boolean,
  reason: string,
  warn = false,
): jest.Describe {
  if (enabled) {
    return describe;
  }
  if (warn && masterEnabled) {
    // eslint-disable-next-line no-console
    console.warn(`[integration] skipping: ${reason}`);
  }
  return describe.skip;
}

export const integrationDescribe: jest.Describe = gatedDescribe(
  integrationConfig.enabled,
  missingCredentialSignal
    ? 'no AWS credential signal found in the environment'
    : 'APPSYNC_PLUGIN_INTEGRATION is not set to 1',
  true,
);

export const cachingDescribe: jest.Describe = gatedDescribe(
  cachingEnabled,
  'set APPSYNC_PLUGIN_INTEGRATION_CACHING=1 to run the caching tier',
);

export const domainDescribe: jest.Describe = gatedDescribe(
  domainEnabled,
  'set APPSYNC_PLUGIN_INTEGRATION_DOMAIN and ' +
    'APPSYNC_PLUGIN_INTEGRATION_HOSTED_ZONE_ID to run the custom-domain tier',
);

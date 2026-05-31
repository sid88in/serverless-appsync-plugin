/**
 * Pure, Jest-free configuration for the integration suite.
 *
 * This module parses the environment only; it references no Jest globals, so it
 * is safe to import from the standalone sweeper (which runs under ts-node, not
 * Jest). The `describe`/`describe.skip` gating lives in ./gate, which is only
 * ever loaded by Jest test files.
 */

const DEFAULT_REGION = 'us-west-2';

const flag = (name: string): boolean => process.env[name] === '1';

export const masterEnabled = flag('APPSYNC_PLUGIN_INTEGRATION');

const region =
  process.env.APPSYNC_PLUGIN_INTEGRATION_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  DEFAULT_REGION;

const profile = process.env.APPSYNC_PLUGIN_INTEGRATION_PROFILE;

/**
 * Best-effort, side-effect-free check that *some* credential source is
 * configured. We deliberately do not make a network call here: the goal is only
 * to skip (rather than hard-fail) when the suite is switched on in an
 * environment that obviously has no credentials.
 */
const hasCredentialSignal = Boolean(
  profile ||
    process.env.AWS_PROFILE ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_SESSION_TOKEN ||
    process.env.AWS_ROLE_ARN ||
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
);

export const integrationConfig = {
  enabled: masterEnabled && hasCredentialSignal,
  region,
  profile,
  /** A region intentionally different from `region`, used by the
   *  credential/region proof to show a live command fails to find the API when
   *  pointed at the wrong region. */
  otherRegion:
    process.env.APPSYNC_PLUGIN_INTEGRATION_OTHER_REGION ||
    (region === 'us-east-1' ? 'us-west-2' : 'us-east-1'),
  expectedAccountId: process.env.APPSYNC_PLUGIN_INTEGRATION_EXPECTED_ACCOUNT_ID,
  caching: flag('APPSYNC_PLUGIN_INTEGRATION_CACHING'),
  domain: {
    name: process.env.APPSYNC_PLUGIN_INTEGRATION_DOMAIN,
    hostedZoneId: process.env.APPSYNC_PLUGIN_INTEGRATION_HOSTED_ZONE_ID,
    certificateArn: process.env.APPSYNC_PLUGIN_INTEGRATION_CERT_ARN,
  },
};

/** Whether the credential signal was missing despite the master switch. */
export const missingCredentialSignal = masterEnabled && !hasCredentialSignal;

export const cachingEnabled =
  integrationConfig.enabled && integrationConfig.caching;

export const domainEnabled =
  integrationConfig.enabled &&
  Boolean(integrationConfig.domain.name) &&
  Boolean(integrationConfig.domain.hostedZoneId);

/** True only when a named profile is provided, enabling the profile half of
 *  the credential/region proof. */
export const profileProofEnabled = Boolean(integrationConfig.profile);

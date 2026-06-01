import { randomBytes } from 'crypto';

/**
 * Every resource created by the integration suite is tagged with this key so
 * the standalone sweeper can find and delete leaked resources from interrupted
 * runs. The value is the per-run id (see {@link generateRunId}).
 */
export const TAG_KEY = 'appsync-plugin-integration';

/**
 * All run ids (and therefore service names and CloudFormation stack names)
 * start with this prefix, so the sweeper can also find resources by name when
 * tags are unavailable (e.g. a CloudFormation stack whose AppSync API was
 * already deleted).
 */
export const RUN_ID_PREFIX = 'appsync-plugin-it';

/**
 * Generate a unique, CloudFormation- and DNS-safe run id, e.g.
 * `appsync-plugin-it-lq3z9k-1a2b3c4d`. Used as the Serverless service name
 * (which drives the stack name), the AppSync API name, and the value of the
 * {@link TAG_KEY} tag.
 */
export function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString('hex');
  return `${RUN_ID_PREFIX}-${ts}-${rand}`;
}

/** The standard Serverless stack name for a service at a stage. */
export function stackName(service: string, stage = 'dev'): string {
  return `${service}-${stage}`;
}

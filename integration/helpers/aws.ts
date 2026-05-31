import {
  AppSyncClient,
  ListGraphqlApisCommand,
  ListTagsForResourceCommand,
  DeleteGraphqlApiCommand,
  ListDomainNamesCommand,
  GetApiAssociationCommand,
  DisassociateApiCommand,
  DeleteDomainNameCommand,
} from '@aws-sdk/client-appsync';
import {
  CloudFormationClient,
  ListStacksCommand,
  DeleteStackCommand,
} from '@aws-sdk/client-cloudformation';
import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { integrationConfig } from './config';
import { TAG_KEY, RUN_ID_PREFIX } from './run-id';

/**
 * Resolve credentials the same way the suite asks the plugin to: from the named
 * profile when one is configured, otherwise the standard default chain. Used by
 * test assertions and the sweeper (NOT by the plugin under test).
 */
export function credentials(): AwsCredentialIdentityProvider {
  return integrationConfig.profile
    ? fromIni({ profile: integrationConfig.profile })
    : fromNodeProviderChain();
}

export function appSyncClient(region: string): AppSyncClient {
  return new AppSyncClient({ region, credentials: credentials() });
}

export function cfnClient(region: string): CloudFormationClient {
  return new CloudFormationClient({ region, credentials: credentials() });
}

export type ParsedArn = {
  partition: string;
  service: string;
  region: string;
  accountId: string;
  resource: string;
};

/** Parse a standard ARN into its components. */
export function parseArn(arn: string): ParsedArn {
  const [, partition, service, region, accountId, ...rest] = arn.split(':');
  return {
    partition,
    service,
    region,
    accountId,
    resource: rest.join(':'),
  };
}

/**
 * Extract the AppSync API ARN from `serverless info --verbose` output. The
 * fixture exposes it as the `IntegrationApiArn` stack output, so the
 * credential/region proof can read where the API landed without building an
 * AWS SDK client inside the Jest VM (the v3 credential provider chain uses a
 * dynamic import() that Jest's default VM rejects).
 */
export function extractApiArn(infoOutput: string): string | undefined {
  const match = infoOutput.match(
    /arn:aws:appsync:[a-z0-9-]+:\d{12}:apis\/[a-zA-Z0-9]+/,
  );
  return match?.[0];
}

// ---------------------------------------------------------------------------
// Sweeper building blocks (also reused by integration/sweeper.ts)
// ---------------------------------------------------------------------------

export type LeakedApi = { apiId: string; arn: string; name?: string };

/** Find AppSync APIs tagged by this suite (leaked from interrupted runs). */
export async function findLeakedApis(region: string): Promise<LeakedApi[]> {
  const client = appSyncClient(region);
  const leaked: LeakedApi[] = [];
  let nextToken: string | undefined;

  do {
    const { graphqlApis, nextToken: next } = await client.send(
      new ListGraphqlApisCommand({ nextToken, maxResults: 25 }),
    );
    for (const api of graphqlApis ?? []) {
      if (!api.arn || !api.apiId) {
        continue;
      }
      const { tags } = await client.send(
        new ListTagsForResourceCommand({ resourceArn: api.arn }),
      );
      const tagValue = tags?.[TAG_KEY];
      if (tagValue && tagValue.startsWith(RUN_ID_PREFIX)) {
        leaked.push({ apiId: api.apiId, arn: api.arn, name: api.name });
      }
    }
    nextToken = next;
  } while (nextToken);

  return leaked;
}

export async function deleteApi(region: string, apiId: string): Promise<void> {
  await appSyncClient(region).send(new DeleteGraphqlApiCommand({ apiId }));
}

/** Find CloudFormation stacks whose name starts with the run-id prefix. */
export async function findLeakedStacks(region: string): Promise<string[]> {
  const client = cfnClient(region);
  const names: string[] = [];
  let nextToken: string | undefined;

  do {
    const { StackSummaries, NextToken } = await client.send(
      new ListStacksCommand({
        NextToken: nextToken,
        StackStatusFilter: [
          'CREATE_COMPLETE',
          'UPDATE_COMPLETE',
          'ROLLBACK_COMPLETE',
          'UPDATE_ROLLBACK_COMPLETE',
          'CREATE_FAILED',
          'ROLLBACK_FAILED',
        ],
      }),
    );
    for (const s of StackSummaries ?? []) {
      if (s.StackName?.startsWith(RUN_ID_PREFIX)) {
        names.push(s.StackName);
      }
    }
    nextToken = NextToken;
  } while (nextToken);

  return names;
}

export async function deleteStack(
  region: string,
  stackName: string,
): Promise<void> {
  await cfnClient(region).send(
    new DeleteStackCommand({ StackName: stackName }),
  );
}

/**
 * Tear down a custom-domain name created outside CloudFormation (Tier D):
 * disassociate any API, then delete the domain name. The ACM certificate is
 * reused, never created, so it is intentionally left untouched.
 */
export async function cleanupDomainName(
  region: string,
  domainName: string,
): Promise<void> {
  const client = appSyncClient(region);
  const { domainNameConfigs } = await client.send(
    new ListDomainNamesCommand({ maxResults: 25 }),
  );
  const exists = domainNameConfigs?.some((d) => d.domainName === domainName);
  if (!exists) {
    return;
  }
  try {
    await client.send(new GetApiAssociationCommand({ domainName }));
    await client.send(new DisassociateApiCommand({ domainName }));
  } catch (err) {
    // NotFoundException => no association to remove; anything else we let the
    // delete below surface.
    if (!(err instanceof Error) || err.name !== 'NotFoundException') {
      // swallow: best-effort cleanup
    }
  }
  await client.send(new DeleteDomainNameCommand({ domainName }));
}

export const config = integrationConfig;

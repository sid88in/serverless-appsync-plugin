import { CfnResource, CfnTemplate } from './synthesize';
import type { AuthenticationType } from '../../src/types/common';

/**
 * Find all resources of a given CloudFormation type.
 */
export function findResourcesByType(
  template: CfnTemplate,
  type: string,
): Array<{ logicalId: string; resource: CfnResource }> {
  return Object.entries(template.Resources)
    .filter(([, r]) => r.Type === type)
    .map(([logicalId, resource]) => ({ logicalId, resource }));
}

/**
 * Find exactly one resource of a given type and return it. Throws if zero
 * or more than one match (forces tests to be explicit about cardinality).
 */
export function findOneResourceByType(
  template: CfnTemplate,
  type: string,
): { logicalId: string; resource: CfnResource } {
  const matches = findResourcesByType(template, type);
  if (matches.length === 0) {
    throw new Error(`Expected exactly one ${type} resource, found none.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Expected exactly one ${type} resource, found ${matches.length}: ` +
        matches.map((m) => m.logicalId).join(', '),
    );
  }
  return matches[0];
}

/**
 * Count resources of a given CloudFormation type.
 */
export function countResourcesByType(
  template: CfnTemplate,
  type: string,
): number {
  return findResourcesByType(template, type).length;
}

/**
 * Assert that a template contains at least one resource of the given type
 * with the given property values. Property matching is partial — only
 * properties listed in `match` need to be present, with deep equality.
 */
export function expectResourceWithProperties(
  template: CfnTemplate,
  type: string,
  match: Record<string, unknown>,
): { logicalId: string; resource: CfnResource } {
  const matches = findResourcesByType(template, type);
  const found = matches.find(({ resource }) =>
    matchesProperties(resource.Properties ?? {}, match),
  );
  if (!found) {
    const summary = matches.map((m) => ({
      logicalId: m.logicalId,
      properties: m.resource.Properties,
    }));
    throw new Error(
      `No ${type} resource matched expected properties.\n` +
        `Expected (partial): ${JSON.stringify(match, null, 2)}\n` +
        `Actual ${type} resources: ${JSON.stringify(summary, null, 2)}`,
    );
  }
  return found;
}

/**
 * Recursive partial-match: every key/value in `expected` must exist in
 * `actual` with the same value. Extra keys in `actual` are ignored.
 */
function matchesProperties(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object') {
    return actual === expected;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (expected.length !== actual.length) return false;
    return expected.every((v, i) => matchesProperties(actual[i], v));
  }
  if (actual === null || typeof actual !== 'object') return false;
  const a = actual as Record<string, unknown>;
  const e = expected as Record<string, unknown>;
  return Object.keys(e).every((k) => matchesProperties(a[k], e[k]));
}

/**
 * Convenience: assert that the GraphQL API has a specific authentication
 * type configured.
 */
export function expectAuthenticationType(
  template: CfnTemplate,
  type: AuthenticationType,
): void {
  const { resource } = findOneResourceByType(
    template,
    'AWS::AppSync::GraphQLApi',
  );
  const props = resource.Properties ?? {};
  const actual = props.AuthenticationType as string | undefined;
  if (actual !== type) {
    throw new Error(
      `Expected AuthenticationType ${type}, got ${actual}.\n` +
        `GraphQLApi properties: ${JSON.stringify(props, null, 2)}`,
    );
  }
}

/**
 * Convenience: assert that a data source of a given AppSync type exists.
 * Returns the matching resource for further inspection.
 */
export function expectDataSourceOfType(
  template: CfnTemplate,
  appsyncType:
    | 'AMAZON_DYNAMODB'
    | 'AWS_LAMBDA'
    | 'AMAZON_OPENSEARCH_SERVICE'
    | 'HTTP'
    | 'RELATIONAL_DATABASE'
    | 'AMAZON_EVENTBRIDGE'
    | 'AMAZON_BEDROCK_RUNTIME'
    | 'NONE',
): { logicalId: string; resource: CfnResource } {
  return expectResourceWithProperties(template, 'AWS::AppSync::DataSource', {
    Type: appsyncType,
  });
}

/**
 * Convenience: return all logical IDs of resources of a given type.
 */
export function logicalIdsByType(
  template: CfnTemplate,
  type: string,
): string[] {
  return findResourcesByType(template, type).map((r) => r.logicalId);
}

/**
 * Get the AppSync GraphQLApi resource (assumes exactly one — true for all
 * single-API examples). Use findResourcesByType for merged API fixtures.
 */
export function getGraphQlApi(template: CfnTemplate): {
  logicalId: string;
  resource: CfnResource;
} {
  return findOneResourceByType(template, 'AWS::AppSync::GraphQLApi');
}

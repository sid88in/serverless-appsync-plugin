import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/api-key-import-existing', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/api-key-import-existing');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates two API key resources', () => {
    expect(countResourcesByType(result.template, 'AWS::AppSync::ApiKey')).toBe(
      2,
    );
  });

  it('passes the apiKeyId through to ApiKeyId on the stable key', () => {
    const keys = findResourcesByType(result.template, 'AWS::AppSync::ApiKey');
    const stable = keys.find(
      (k) =>
        k.resource.Properties?.Description ===
        'Stable key migrated from previous infrastructure',
    );
    if (!stable) throw new Error('stable api key not found');
    expect(stable.resource.Properties?.ApiKeyId).toBe(
      'da2-rotated-stable-key-id-abc123',
    );
  });

  it('does NOT set ApiKeyId on the rotating key (lets AppSync generate one)', () => {
    const keys = findResourcesByType(result.template, 'AWS::AppSync::ApiKey');
    const rotating = keys.find(
      (k) =>
        k.resource.Properties?.Description ===
        'Net-new key created by this stack',
    );
    if (!rotating) throw new Error('rotating api key not found');
    expect(rotating.resource.Properties?.ApiKeyId).toBeUndefined();
  });
});

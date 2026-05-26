import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/api-keys-multiple', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/api-keys-multiple');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates three distinct API key resources', () => {
    expect(countResourcesByType(result.template, 'AWS::AppSync::ApiKey')).toBe(
      3,
    );
  });

  it('each API key has its own description matching the config', () => {
    const keys = findResourcesByType(result.template, 'AWS::AppSync::ApiKey');
    const descriptions = keys
      .map((k) => k.resource.Properties?.Description as string)
      .sort();
    expect(descriptions).toEqual([
      'Internal testing',
      'Mobile app key',
      'Web app key',
    ]);
  });

  it('each API key has an expiry set', () => {
    const keys = findResourcesByType(result.template, 'AWS::AppSync::ApiKey');
    keys.forEach((k) => {
      // The plugin computes an absolute Unix timestamp for Expires
      const expires = k.resource.Properties?.Expires;
      expect(expires).toBeDefined();
      expect(typeof expires).toBe('number');
    });
  });
});

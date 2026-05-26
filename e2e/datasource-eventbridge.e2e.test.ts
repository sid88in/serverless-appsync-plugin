import { synthesize } from './helpers/synthesize';
import { expectDataSourceOfType } from './helpers/assertions';

describe('examples/datasource-eventbridge', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/datasource-eventbridge');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates an AMAZON_EVENTBRIDGE data source', () => {
    const ds = expectDataSourceOfType(result.template, 'AMAZON_EVENTBRIDGE');
    expect(ds.resource.Properties?.Name).toBe('event_bus');
  });

  it('configures the event bus ARN', () => {
    const ds = expectDataSourceOfType(result.template, 'AMAZON_EVENTBRIDGE');
    const ebConfig = ds.resource.Properties?.EventBridgeConfig as Record<
      string,
      unknown
    >;
    expect(ebConfig).toBeDefined();
    expect(ebConfig.EventBusArn).toBeDefined();
  });
});

import { synthesize } from './helpers/synthesize';
import {
  findOneResourceByType,
  findResourcesByType,
  getGraphQlApi,
} from './helpers/assertions';

describe('examples/logging-xray', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/logging-xray');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('enables X-Ray tracing on the GraphQLApi', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.XrayEnabled).toBe(true);
  });

  it('configures field-level logging at level ALL', () => {
    const { resource } = getGraphQlApi(result.template);
    const logConfig = resource.Properties?.LogConfig as Record<string, unknown>;
    expect(logConfig).toBeDefined();
    expect(logConfig.FieldLogLevel).toBe('ALL');
    expect(logConfig.ExcludeVerboseContent).toBe(false);
    expect(logConfig.CloudWatchLogsRoleArn).toBeDefined();
  });

  it('creates a CloudWatch Logs group with the configured retention', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::Logs::LogGroup',
    );
    expect(resource.Properties?.RetentionInDays).toBe(14);
  });

  it('creates an IAM role that AppSync can use to write logs', () => {
    // There's at least one IAM role created for AppSync to write to CloudWatch
    const roles = findResourcesByType(result.template, 'AWS::IAM::Role');
    expect(roles.length).toBeGreaterThanOrEqual(1);
  });
});

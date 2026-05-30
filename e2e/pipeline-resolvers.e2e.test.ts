import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/pipeline-resolvers', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/pipeline-resolvers');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates two AppSync functions', () => {
    expect(
      countResourcesByType(
        result.template,
        'AWS::AppSync::FunctionConfiguration',
      ),
    ).toBe(2);
  });

  it('creates a PIPELINE resolver wired to both functions', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    expect(resolvers).toHaveLength(1);
    const props = resolvers[0].resource.Properties as Record<string, unknown>;
    expect(props.Kind).toBe('PIPELINE');
    expect(props.PipelineConfig).toBeDefined();
    const pipelineConfig = props.PipelineConfig as { Functions: unknown[] };
    expect(pipelineConfig.Functions).toHaveLength(2);
  });

  it('creates two data sources', () => {
    expect(
      countResourcesByType(result.template, 'AWS::AppSync::DataSource'),
    ).toBe(2);
  });
});

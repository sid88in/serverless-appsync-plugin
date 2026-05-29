import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/pipeline-resolver-with-code', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/pipeline-resolver-with-code');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates one pipeline resolver and two pipeline functions', () => {
    expect(
      countResourcesByType(result.template, 'AWS::AppSync::Resolver'),
    ).toBe(1);
    expect(
      countResourcesByType(
        result.template,
        'AWS::AppSync::FunctionConfiguration',
      ),
    ).toBe(2);
  });

  it('the pipeline resolver has both its own Code AND a Runtime', () => {
    const resolvers = findResourcesByType(
      result.template,
      'AWS::AppSync::Resolver',
    );
    expect(resolvers).toHaveLength(1);
    const props = resolvers[0].resource.Properties as Record<string, unknown>;
    expect(props.Kind).toBe('PIPELINE');
    // This is the key assertion: the resolver itself has Code (the
    // before/after JS), not just delegating to its functions.
    expect(props.Code).toBeDefined();
    expect(props.Runtime).toEqual({
      Name: 'APPSYNC_JS',
      RuntimeVersion: '1.0.0',
    });
    // And the PipelineConfig references both functions
    const pipelineConfig = props.PipelineConfig as { Functions: unknown[] };
    expect(pipelineConfig.Functions).toHaveLength(2);
  });

  it('each pipeline function also has its own Code + Runtime', () => {
    const functions = findResourcesByType(
      result.template,
      'AWS::AppSync::FunctionConfiguration',
    );
    expect(functions).toHaveLength(2);
    functions.forEach((fn) => {
      const props = fn.resource.Properties as Record<string, unknown>;
      expect(props.Code).toBeDefined();
      expect(props.Runtime).toEqual({
        Name: 'APPSYNC_JS',
        RuntimeVersion: '1.0.0',
      });
    });
  });
});

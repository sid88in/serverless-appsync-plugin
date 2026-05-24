import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findOneResourceByType,
} from './helpers/assertions';

describe('examples/schema-multiple-files', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/schema-multiple-files');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('concatenates all .graphql files into one schema definition', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::AppSync::GraphQLSchema',
    );
    const props = resource.Properties as Record<string, unknown>;
    const definition = props.Definition as string;
    // All three files' top-level types should appear in the joined schema
    expect(definition).toContain('type Query');
    expect(definition).toContain('type User');
    expect(definition).toContain('type Post');
  });

  it('creates resolvers from both User and Post type definitions', () => {
    expect(
      countResourcesByType(result.template, 'AWS::AppSync::Resolver'),
    ).toBe(2);
  });
});

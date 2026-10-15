import * as fs from 'fs';
import * as path from 'path';
import { synthesize } from './helpers/synthesize';
import { findOneResourceByType } from './helpers/assertions';

describe('examples/schema-s3', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/schema-s3');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('references the schema in S3 and writes it to the package', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::AppSync::GraphQLSchema',
    );
    expect(resource.Properties).not.toHaveProperty('Definition');
    expect(resource.Properties).toHaveProperty('DefinitionS3Location');
    expect(
      fs.readFileSync(
        path.join(result.packageDir, 'appsync-schema.graphql'),
        'utf8',
      ),
    ).toContain('type User');
  });
});

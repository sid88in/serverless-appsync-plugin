import * as fs from 'fs';
import * as path from 'path';
import { synthesize } from './helpers/synthesize';
import { findOneResourceByType } from './helpers/assertions';

describe('examples/upload-to-s3', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/upload-to-s3');
  });

  afterAll(() => {
    result.cleanup();
  });

  // The file name is the last part of the S3 key in the Fn::Join.
  const packagedFile = (location: unknown) => {
    const parts = (location as { 'Fn::Join': [string, string[]] })[
      'Fn::Join'
    ][1];
    const key = parts[parts.length - 1];
    return fs.readFileSync(
      path.join(result.packageDir, 'appsync', path.basename(key)),
      'utf8',
    );
  };

  it.each([
    [
      'AWS::AppSync::GraphQLSchema',
      'DefinitionS3Location',
      'Definition',
      'type User',
    ],
    [
      'AWS::AppSync::Resolver',
      'CodeS3Location',
      'Code',
      'export function request',
    ],
    [
      'AWS::AppSync::FunctionConfiguration',
      'CodeS3Location',
      'Code',
      'payload',
    ],
  ])(
    '%s references a packaged file',
    (type, locationProperty, inlineProperty, content) => {
      const { resource } = findOneResourceByType(result.template, type);
      expect(resource.Properties).not.toHaveProperty(inlineProperty);
      expect(packagedFile(resource.Properties?.[locationProperty])).toContain(
        content,
      );
    },
  );
});

import globby from 'globby';
import fs from 'fs';
import path from 'path';
import { CfnResources } from '../types/cloudFormation';
import { Api } from './Api';
import { flatten } from 'lodash';
import { parse, print } from 'graphql';
import { validateSDL } from 'graphql/validation/validate';
import { mergeTypeDefs } from '@graphql-tools/merge';

const AWS_TYPES = `
directive @aws_iam on FIELD_DEFINITION | OBJECT
directive @aws_oidc on FIELD_DEFINITION | OBJECT
directive @aws_api_key on FIELD_DEFINITION | OBJECT
directive @aws_lambda on FIELD_DEFINITION | OBJECT
directive @aws_auth(cognito_groups: [String]) on FIELD_DEFINITION | OBJECT
directive @aws_cognito_user_pools(
  cognito_groups: [String]
) on FIELD_DEFINITION | OBJECT
directive @aws_subscribe(mutations: [String]) on FIELD_DEFINITION
scalar AWSDate
scalar AWSTime
scalar AWSDateTime
scalar AWSTimestamp
scalar AWSEmail
scalar AWSJSON
scalar AWSURL
scalar AWSPhone
scalar AWSIPAddress
`;

export class Schema {
  constructor(private api: Api, private schemas: string[]) {}

  compile(): CfnResources {
    const logicalId = this.api.naming.getSchemaLogicalId();

    return {
      [logicalId]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          Definition: this.generateSchema(),
          ApiId: this.api.getApiId(),
        },
      },
    };
  }

  validateSchema(schema: string) {
    const errors = validateSDL(parse(schema));
    if (errors.length > 0) {
      throw new this.api.plugin.serverless.classes.Error(
        'Invalid GraphQL schema:\n' +
          errors.map((error) => `     ${error.message}`).join('\n'),
      );
    }
  }

  // AppSync does not support descriptions from June 2018 spec
  // https://spec.graphql.org/June2018/#sec-Descriptions
  // so they need to be converted to comments, the space after the # will also be included
  // by AppSync in the generated description so we remove it
  convertDescriptions(schema: string): string {
    const lines = schema.split('\n');
    const singleLineComment = /^(?<indent> *)"(?<comment>[^"]+?)"$/;
    const singleLineMultilineComment = /^(?<indent> *)"""(?<comment>.+?)"""$/;
    const multilineCommentDelimiter = /^(?<indent> *)"""$/;

    let inComment = false;
    let result = '';

    for (const line of lines) {
      switch (true) {
        case singleLineComment.test(line):
          result += `${line.match(singleLineComment)?.groups?.indent}#${
            line.match(singleLineComment)?.groups?.comment
          }\n`;
          break;
        case singleLineMultilineComment.test(line):
          result += `${
            line.match(singleLineMultilineComment)?.groups?.indent
          }#${line.match(singleLineMultilineComment)?.groups?.comment}\n`;
          break;
        case multilineCommentDelimiter.test(line):
          inComment = !inComment;
          break;
        case inComment:
          result += `${
            line.match(/^(?<indent> *)/)?.groups?.indent
          }#${line.trimStart()}\n`;
          break;
        default:
          result += line + '\n';
      }
    }

    return result;
  }

  generateSchema() {
    const schemaFiles = flatten(globby.sync(this.schemas));

    const schemas = schemaFiles.map((file) => {
      return fs.readFileSync(
        path.join(this.api.plugin.serverless.config.servicePath, file),
        'utf8',
      );
    });

    this.validateSchema(AWS_TYPES + '\n' + schemas.join('\n'));

    // Return single files as-is.
    if (schemas.length === 1) {
      return this.convertDescriptions(schemas[0]);
    }

    // AppSync does not support Object extensions
    // https://spec.graphql.org/October2021/#sec-Object-Extensions
    // Merge the schemas
    return this.convertDescriptions(
      print(
        mergeTypeDefs(schemas, {
          forceSchemaDefinition: false,
          useSchemaDefinition: false,
          sort: true,
          throwOnConflict: true,
        }),
      ),
    );
  }
}

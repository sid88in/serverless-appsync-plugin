import globby from 'globby';
import fs from 'fs';
import path from 'path';
import { CfnResources } from '../types/cloudFormation';
import { Api } from './Api';
import { flatten } from 'lodash';
import { buildSchema, parse, printSchema } from 'graphql';
import ServerlessError from 'serverless/lib/serverless-error';
import { validateSDL } from 'graphql/validation/validate';
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

  valdiateSchema(schema: string) {
    const errors = validateSDL(parse(schema));
    if (errors.length > 0) {
      throw new ServerlessError(
        'Invalid GraphQL schema:\n' +
          errors.map((error) => `     ${error.message}`).join('\n'),
      );
    }
  }

  generateSchema() {
    const schemaFiles = flatten(globby.sync(this.schemas));

    const schemas = schemaFiles.map((file) => {
      return fs.readFileSync(
        path.join(this.api.plugin.serverless.config.servicePath, file),
        'utf8',
      );
    });

    this.valdiateSchema(schemas.join('\n'));

    // Return single files as-is.
    if (schemas.length === 1) {
      return schemas[0];
    }

    // AppSync does not support Object extensions
    // https://spec.graphql.org/October2021/#sec-Object-Extensions
    // the workwaround is to build a GraphQLSchema and print it back
    return printSchema(
      buildSchema(schemas.join('\n'), {
        assumeValidSDL: true,
      }),
    );
  }
}

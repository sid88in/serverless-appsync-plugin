import globby from 'globby';
import fs from 'fs';
import path from 'path';
import { CfnResources } from '../types/cloudFormation';
import { Api } from './Api';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { convertAppSyncSchemas } from 'appsync-schema-converter';
import { flatten } from 'lodash';

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

  generateSchema() {
    const schemaFiles = flatten(globby.sync(this.schemas));
    const schemas = schemaFiles.map((file) => {
      return fs.readFileSync(
        path.join(this.api.plugin.serverless.config.servicePath, file),
        'utf8',
      );
    });
    const mergedSchema = mergeTypeDefs(schemas, {
      useSchemaDefinition: true,
      forceSchemaDefinition: true,
      throwOnConflict: true,
      commentDescriptions: true,
      reverseDirectives: true,
    });

    return convertAppSyncSchemas(mergedSchema);
  }
}

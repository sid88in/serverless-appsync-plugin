import globby from 'globby';
import fs from 'fs';
import path from 'path';
import { CfnResources } from '../types/cloudFormation';
import { Api } from './Api';
import { flatten } from 'lodash';
import {
  parse,
  print,
  visit,
  Kind,
  TokenKind,
  ASTNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  FieldDefinitionNode,
  StringValueNode,
  Token,
} from 'graphql';
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
directive @canonical on OBJECT | FIELD_DEFINITION
directive @hidden on OBJECT | FIELD_DEFINITION
directive @renamed on OBJECT | FIELD_DEFINITION
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

// The directive and scalar names AppSync provides itself (derived from
// AWS_TYPES so the two never drift). User schemas that redeclare any of these
// — often to satisfy a schema linter — must have the redeclaration stripped,
// otherwise validation sees a duplicate definition and AppSync rejects the
// upload.
const reservedNames = ((): {
  directives: Set<string>;
  types: Set<string>;
} => {
  const directives = new Set<string>();
  const types = new Set<string>();
  for (const def of parse(AWS_TYPES).definitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directives.add(def.name.value);
    } else if ('name' in def && def.name) {
      types.add(def.name.value);
    }
  }
  return { directives, types };
})();

export class Schema {
  constructor(private api: Api, private schemas: string[]) {}

  compile(): CfnResources {
    const logicalId = this.api.naming.getSchemaLogicalId();
    const definition = this.generateSchema();

    return {
      [logicalId]: {
        Type: 'AWS::AppSync::GraphQLSchema',
        Properties: {
          ...(this.api.config.uploadSchemaToS3
            ? {
                DefinitionS3Location: this.api.getS3Location(
                  'schema',
                  'graphql',
                  definition,
                ),
              }
            : { Definition: definition }),
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

  // AppSync ignores spec descriptions (https://spec.graphql.org/June2018/#sec-Descriptions)
  // and reads `#` comments instead, with these rules:
  // - an empty comment line resets the description, so blank lines are removed;
  // - argument and enum value descriptions are dropped, so they are folded
  //   into the description of their field, directive or enum.
  convertDescriptions(schema: string): string {
    const doc = visit(parse(schema), {
      enter(node) {
        if (!('description' in node) || node.description || !node.loc) {
          return undefined;
        }
        const comment = leadingComment(node.loc.startToken);
        return comment === undefined
          ? undefined
          : { ...node, description: toStringValue(comment) };
      },
      FieldDefinition: { leave: foldArguments },
      DirectiveDefinition: { leave: foldArguments },
      EnumTypeDefinition: {
        leave: (node) => ({
          ...node,
          description: fold(node.description, 'Values', node.values),
          values: node.values?.map(withoutDescription),
        }),
      },
    });
    return doc.definitions.map(printWithComments).join('\n\n') + '\n';
  }

  generateSchema() {
    const schemaFiles = flatten(
      globby.sync(
        this.schemas.map((schema) =>
          path
            // `path.resolve` keeps relative paths resolved against the
            // service directory while leaving absolute paths untouched
            // (`path.join` would incorrectly prefix them with servicePath).
            .resolve(this.api.plugin.serverless.config.servicePath, schema)
            .replace(/\\/g, '/'),
        ),
      ),
    );

    const schemas = schemaFiles.map((file) => {
      return this.stripReservedDefinitions(fs.readFileSync(file, 'utf8'));
    });

    this.validateSchema(AWS_TYPES + '\n' + schemas.join('\n'));

    // Return single (already stripped) files as-is.
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

  // AppSync provides its own directives (@aws_*, plus the plugin's merge
  // directives) and scalars (AWSJSON, AWSDateTime, ...). Users sometimes also
  // declare them — e.g. to satisfy a schema linter — which collides with the
  // definitions we prepend for validation and is rejected by AppSync on
  // deploy. Strip any such redeclaration, leaving the original text untouched
  // when there is nothing to remove.
  stripReservedDefinitions(schema: string): string {
    const doc = parse(schema);
    const definitions = doc.definitions.filter(
      (def) => !isReservedDefinition(def),
    );
    if (definitions.length === doc.definitions.length) {
      return schema;
    }
    return print({ ...doc, definitions });
  }
}

function isReservedDefinition(def: DefinitionNode): boolean {
  if (def.kind === Kind.DIRECTIVE_DEFINITION) {
    return reservedNames.directives.has(def.name.value);
  }
  if ('name' in def && def.name) {
    return reservedNames.types.has(def.name.value);
  }
  return false;
}

type Described = { readonly description?: StringValueNode };
type Named = Described & { readonly name: { readonly value: string } };

function descriptionLines(description?: StringValueNode): string[] {
  return (description?.value ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
}

function toStringValue(value: string): StringValueNode {
  return { kind: Kind.STRING, value, block: true };
}

function withoutDescription<T extends Described>(node: T): T {
  return { ...node, description: undefined };
}

// Appends `- \`name\`: description` for each item that has a description.
function fold(
  description: StringValueNode | undefined,
  title: string,
  items: readonly Named[] | undefined,
): StringValueNode | undefined {
  const entries = (items ?? []).flatMap((item) => {
    const lines = descriptionLines(item.description);
    return lines.length
      ? [`- \`${item.name.value}\`: ${lines.join('\n  ')}`]
      : [];
  });
  if (!entries.length) {
    return description;
  }
  return toStringValue(
    [...descriptionLines(description), `${title}:`, ...entries].join('\n'),
  );
}

function foldArguments<T extends FieldDefinitionNode | DirectiveDefinitionNode>(
  node: T,
): T {
  return {
    ...node,
    description: fold(node.description, 'Arguments', node.arguments),
    arguments: node.arguments?.map(withoutDescription),
  };
}

// The `#` comment block directly above a token, as graphql-tools reads it with
// `commentDescriptions`. Only a single-file schema still has its comments: the
// merged schema is printed by graphql-tools, which drops them.
function leadingComment(token: Token): string | undefined {
  const lines: string[] = [];
  let comment = token.prev;
  while (
    comment?.kind === TokenKind.COMMENT &&
    comment.next?.line === comment.line + 1 &&
    comment.prev?.line !== comment.line
  ) {
    lines.unshift(comment.value);
    comment = comment.prev;
  }
  return lines.length ? lines.join('\n') : undefined;
}

function commentBlock(node: ASTNode): string {
  const lines = descriptionLines((node as Described).description);
  return lines.map((line) => `#${line}\n`).join('');
}

function printWithoutDescription(node: ASTNode): string {
  return (
    commentBlock(node) + print(withoutDescription(node as Described & ASTNode))
  );
}

function indent(text: string): string {
  return '  ' + text.replace(/\n/g, '\n  ');
}

// `print` would emit the remaining descriptions as strings, so the
// definitions and their fields are printed one by one, each after its comment.
function printWithComments(def: DefinitionNode): string {
  if (!('fields' in def) || !def.fields?.length) {
    return printWithoutDescription(def);
  }
  const fields: readonly ASTNode[] = def.fields;
  const head = printWithoutDescription({ ...def, fields: [] } as ASTNode);
  const body = fields.map((field) => indent(printWithoutDescription(field)));
  return `${head} {\n${body.join('\n')}\n}`;
}

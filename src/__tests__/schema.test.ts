import * as path from 'path';
import { Api } from '../resources/Api';
import { Schema } from '../resources/Schema';
import * as given from './given';

const plugin = given.plugin();

describe('schema', () => {
  it('should generate a schema resource', () => {
    const api = new Api(
      given.appSyncConfig({
        schema: ['src/__tests__/fixtures/schemas/single/schema.graphql'],
      }),
      plugin,
    );

    expect(api.compileSchema()).toMatchInlineSnapshot(`
      {
        "GraphQlSchema": {
          "Properties": {
            "ApiId": {
              "Fn::GetAtt": [
                "GraphQlApi",
                "ApiId",
              ],
            },
            "Definition": "type Query {
        getUser: User!
      }

      type Mutation {
        createUser(post: UserInput!): User!
      }

      """
      A User
      """
      type User {
        id: ID!
        name: String!
      }

      # Input for user
      input UserInput {
        name: String!
      }
      ",
          },
          "Type": "AWS::AppSync::GraphQLSchema",
        },
      }
    `);
  });

  it('should merge the schemas', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const schema = new Schema(api, [
      'src/__tests__/fixtures/schemas/multiple/schema.graphql',
      'src/__tests__/fixtures/schemas/multiple/user.graphql',
      'src/__tests__/fixtures/schemas/multiple/post.graphql',
    ]);
    expect(schema.generateSchema()).toMatchInlineSnapshot(`
      "type Mutation {
        createPost(post: PostInput!): Post!
        createUser(post: UserInput!): User!
      }

      type Post @aws_oidc {
        id: ID!
        title: String!
        createdAt: AWSDateTime!
        updatedAt: AWSDateTime!
      }

      """This is a description"""
      input PostInput {
        title: String!
      }

      type Query {
        getPost(id: ID!): Post!
        getUser: User!
      }

      type User {
        id: ID!
        name: String!
        role: String! @aws_oidc
        email: AWSEmail!
        posts: [Post!]!
      }

      input UserInput {
        name: String!
      }"
    `);
  });

  it('should merge glob schemas', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const schema = new Schema(api, [
      'src/__tests__/fixtures/schemas/multiple/*.graphql',
    ]);
    expect(schema.generateSchema()).toMatchInlineSnapshot(`
      "type Mutation {
        createPost(post: PostInput!): Post!
        createUser(post: UserInput!): User!
      }

      type Post @aws_oidc {
        id: ID!
        title: String!
        createdAt: AWSDateTime!
        updatedAt: AWSDateTime!
      }

      """This is a description"""
      input PostInput {
        title: String!
      }

      type Query {
        getPost(id: ID!): Post!
        getUser: User!
      }

      type User {
        id: ID!
        name: String!
        role: String! @aws_oidc
        email: AWSEmail!
        posts: [Post!]!
      }

      input UserInput {
        name: String!
      }"
    `);
  });

  it('should merge glob schemas with Windows paths', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const schema = new Schema(api, [
      'src\\__tests__\\fixtures\\schemas\\multiple\\*.graphql',
    ]);
    expect(schema.generateSchema()).toMatchInlineSnapshot(`
      "type Mutation {
        createPost(post: PostInput!): Post!
        createUser(post: UserInput!): User!
      }

      type Post @aws_oidc {
        id: ID!
        title: String!
        createdAt: AWSDateTime!
        updatedAt: AWSDateTime!
      }

      """This is a description"""
      input PostInput {
        title: String!
      }

      type Query {
        getPost(id: ID!): Post!
        getUser: User!
      }

      type User {
        id: ID!
        name: String!
        role: String! @aws_oidc
        email: AWSEmail!
        posts: [Post!]!
      }

      input UserInput {
        name: String!
      }"
    `);
  });

  it('should fail if schema is invalid', () => {
    const api = new Api(
      given.appSyncConfig({
        schema: [
          'src/__tests__/fixtures/schemas/multiple/schema.graphql',
          'src/__tests__/fixtures/schemas/multiple/user.graphql',
        ],
      }),
      plugin,
    );
    expect(() => api.compileSchema()).toThrowErrorMatchingInlineSnapshot(`
      "Invalid GraphQL schema:
           Unknown type "Post"."
    `);
  });

  it('should accept merged-API directives on OBJECT and FIELD_DEFINITION', () => {
    const api = new Api(
      given.appSyncConfig({
        schema: [
          'src/__tests__/fixtures/schemas/merge-directives/schema.graphql',
        ],
      }),
      plugin,
    );
    expect(() => api.compileSchema()).not.toThrow();
  });

  it('should accept and strip schemas that redeclare AWS directives/scalars', () => {
    const api = new Api(
      given.appSyncConfig({
        schema: ['src/__tests__/fixtures/schemas/reserved/schema.graphql'],
      }),
      plugin,
    );
    // Previously threw: There can be only one directive named "@aws_cognito_user_pools".
    expect(() => api.compileSchema()).not.toThrow();

    const output = new Schema(api, [
      'src/__tests__/fixtures/schemas/reserved/schema.graphql',
    ]).generateSchema();

    // The redeclarations are removed (AppSync provides them)...
    expect(output).not.toMatch(/directive @aws_cognito_user_pools/);
    expect(output).not.toMatch(/scalar AWSJSON/);
    // ...but their usage is preserved.
    expect(output).toContain('@aws_cognito_user_pools');
    expect(output).toContain('AWSJSON');
  });

  it('should support absolute schema paths regardless of servicePath', () => {
    const plugin = given.plugin();
    // servicePath deliberately points somewhere the schema is NOT;
    // an absolute schema path must still be read correctly.
    plugin.serverless.config.servicePath = path.resolve('does', 'not', 'exist');
    const api = new Api(given.appSyncConfig(), plugin);
    const absolutePath = path.resolve(
      'src/__tests__/fixtures/schemas/single/schema.graphql',
    );
    const schema = new Schema(api, [absolutePath]);
    expect(schema.generateSchema()).toContain('type Query');
  });

  it('should resolve relative schema paths against servicePath', () => {
    const plugin = given.plugin();
    plugin.serverless.config.servicePath = process.cwd();
    const api = new Api(given.appSyncConfig(), plugin);
    const schema = new Schema(api, [
      'src/__tests__/fixtures/schemas/single/schema.graphql',
    ]);
    expect(schema.generateSchema()).toContain('type Query');
  });

  it('should return single files schemas as-is', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const schema = new Schema(api, [
      'src/__tests__/fixtures/schemas/single/schema.graphql',
    ]);
    expect(schema.generateSchema()).toMatchInlineSnapshot(`
      "type Query {
        getUser: User!
      }

      type Mutation {
        createUser(post: UserInput!): User!
      }

      """
      A User
      """
      type User {
        id: ID!
        name: String!
      }

      # Input for user
      input UserInput {
        name: String!
      }
      "
    `);
  });
});

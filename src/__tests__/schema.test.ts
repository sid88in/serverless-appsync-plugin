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
      Object {
        "GraphQlSchema": Object {
          "Properties": Object {
            "ApiId": Object {
              "Fn::GetAtt": Array [
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

      \\"\\"\\"
      A User
      \\"\\"\\"
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

  it('should generate a schema resource if apiId is provided', () => {
    const api = new Api(
      given.appSyncConfig({
        apiId: '123',
      }),
      plugin,
    );

    expect(api.compileSchema()).toMatchInlineSnapshot(`Object {}`);
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

      \\"\\"\\"This is a description\\"\\"\\"
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

      \\"\\"\\"This is a description\\"\\"\\"
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
           Unknown type \\"Post\\"."
    `);
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

      \\"\\"\\"
      A User
      \\"\\"\\"
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

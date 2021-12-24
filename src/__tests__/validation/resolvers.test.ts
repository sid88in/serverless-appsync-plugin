import { validateConfig } from '../../validation';
import { basicConfig } from '../basicConfig';

describe('Basic', () => {
  describe('Valid', () => {
    const assertions = [
      {
        name: 'Valid config',
        config: {
          resolvers: {
            'Query.getUser': {
              kind: 'UNIT',
              dataSource: 'myDs',
            },
            'Query.getPost': {
              kind: 'PIPELINE',
              functions: ['function1', 'function2'],
            },
            'Query.getBlog': {
              dataSource: 'myDs',
            },
            'Query.getComment': 'myDs',
            getUsers: {
              type: 'Query',
              field: 'getUsers',
              kind: 'UNIT',
              dataSource: 'myDs',
            },
            getPosts: {
              type: 'Query',
              field: 'getPosts',
              kind: 'PIPELINE',
              functions: ['function1', 'function2'],
            },
            getBlogs: {
              type: 'Query',
              field: 'getUsers',
              dataSource: 'myDs',
            },
            getComments: {
              type: 'Query',
              field: 'getComments',
              dataSource: {
                type: 'AWS_LAMBDA',
                name: 'getComments',
                config: {
                  functionName: 'getComments',
                },
              },
            },
          },
        },
      },
      {
        name: 'Valid config, as array of maps',
        config: {
          resolvers: [
            {
              'Query.getUser': {
                kind: 'UNIT',
                dataSource: 'myDs',
              },
              'Query.getPost': {
                kind: 'PIPELINE',
                functions: ['function1', 'function2'],
              },
              'Query.getBlog': {
                dataSource: 'myDs',
              },
              'Query.getComment': 'myDs',
            },
            {
              getUsers: {
                type: 'Query',
                field: 'getUsers',
                kind: 'UNIT',
                dataSource: 'myDs',
              },
              getPosts: {
                type: 'Query',
                field: 'getPosts',
                kind: 'PIPELINE',
                functions: ['function1', 'function2'],
              },
              'Query.getComment': {
                dataSource: {
                  type: 'AWS_LAMBDA',
                  name: 'getComment',
                  config: {
                    functionName: 'getComment',
                  },
                },
              },
            },
          ],
        },
      },
    ];

    assertions.forEach((config) => {
      it(`should validate a ${config.name}`, () => {
        expect(validateConfig({ ...basicConfig, ...config.config })).toBe(true);
      });
    });
  });

  describe('Invalid', () => {
    const assertions = [
      {
        name: 'Invalid',
        config: {
          resolvers: {
            myResolver: {
              kind: 'FOO',
              dataSource: 999,
              type: 123,
              field: 456,
              request: 123,
              response: 456,
            },
          },
        },
      },
      {
        name: 'Missing datasource',
        config: {
          resolvers: {
            'Query.user': {
              kind: 'UNIT',
            },
          },
        },
      },
      {
        name: 'Missing functions',
        config: {
          resolvers: {
            'Query.user': {
              kind: 'PIPELINE',
            },
          },
        },
      },
      {
        name: 'Missing type and field',
        config: {
          resolvers: {
            myResolver: {
              kind: 'UNIT',
              dataSource: 'myDs',
            },
          },
        },
      },
      {
        name: 'Missing type and field inline',
        config: {
          resolvers: {
            myResolver: 'dataSource',
          },
        },
      },
      {
        name: 'Invalid inline datasource',
        config: {
          resolvers: {
            'Query.getUser': 1234,
          },
        },
      },
      {
        name: 'Invalid embedded datasource',
        config: {
          resolvers: {
            'Query.getUser': {
              dataSource: {
                type: 'AWS_LAMBDA',
                config: {},
              },
            },
          },
        },
      },
    ];

    assertions.forEach((config) => {
      it(`should validate: ${config.name}`, () => {
        expect(function () {
          validateConfig({
            ...basicConfig,
            ...config.config,
          });
        }).toThrowErrorMatchingSnapshot();
      });
    });
  });
});

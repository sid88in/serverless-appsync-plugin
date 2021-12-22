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
        name: 'Missing field and type',
        config: {
          resolvers: {
            myResolver: {
              kind: 'UNIT',
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

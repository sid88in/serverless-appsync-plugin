const getConfig = require('./get-config');
const path = require('path');

const servicePath = path.join(__dirname, 'example');

test('authenticationType is missing', () => {
  const run = () => getConfig({}, {}, servicePath);
  expect(run).toThrowErrorMatchingSnapshot();
});

test('authenticationType is missing', () => {
  const run = () =>
    getConfig(
      {
      },
      {},
      servicePath,
    );
  expect(run).toThrowErrorMatchingSnapshot();
});

test('returns valid config', () => {
  expect(getConfig(
    {
      authenticationType: 'AWS_IAM',
      dataSources: {
        users: {
          type: 'AMAZON_DYNAMODB',
        },
        tweets: {
          type: 'AMAZON_DYNAMODB',
        },
      },
    },
    { region: 'us-east-1' },
    servicePath,
  )[0]).toMatchSnapshot();
});

test('datasources as array', () => {
  expect(getConfig(
    {
      authenticationType: 'AWS_IAM',
      dataSources: [
        {
          name: 'users',
          type: 'AMAZON_DYNAMODB',
        },
        {
          name: 'tweets',
          type: 'AMAZON_DYNAMODB',
        },
      ],
    },
    { region: 'us-east-1' },
    servicePath
  )[0]).toMatchSnapshot();
});

test('datasources as array form different files (array of arrays or objects)', () => {

  expect(getConfig(
    {
      authenticationType: 'AWS_IAM',
      dataSources: [ // File one: key-based datasources
        {
          users: {
            type: 'AMAZON_DYNAMODB',
          },
          tweets: {
            type: 'AMAZON_DYNAMODB',
          },
        },
        [ // file 2: array of datasources
          {
            name: 'foo',
            type: 'AMAZON_DYNAMODB',
          },
          {
            name: 'bar',
            type: 'AMAZON_DYNAMODB',
          },
        ]
      ],
    },
    { region: 'us-east-1' },
    servicePath
  )[0]).toMatchSnapshot();
});
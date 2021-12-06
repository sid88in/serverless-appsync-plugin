// @ts-nocheck
import { getConfig } from '../src/get-config';
import path from 'path';

const servicePath = path.join(__dirname, '../example');

test('authenticationType is missing', async () => {
  await expect(getConfig({}, {}, servicePath)).rejects.toMatchSnapshot();
});

test('authenticationType is missing', async () => {
  await expect(getConfig({}, {}, servicePath)).rejects.toMatchSnapshot();
});

test('authenticationType can be missing when apiId is provided', async () => {
  expect(
    await getConfig(
      {
        apiId: 'testApiId',
      },
      { region: 'us-east-1' },
      servicePath,
    ),
  ).toMatchSnapshot();
});

test('returns valid config', async () => {
  expect(
    await getConfig(
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
    ),
  ).toMatchSnapshot();
});

test('datasources as array', async () => {
  expect(
    await getConfig(
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
      servicePath,
    ),
  ).toMatchSnapshot();
});

test('datasources as array form different files (array of arrays or objects)', async () => {
  expect(
    await getConfig(
      {
        authenticationType: 'AWS_IAM',
        dataSources: [
          // File one: key-based datasources
          {
            users: {
              type: 'AMAZON_DYNAMODB',
            },
            tweets: {
              type: 'AMAZON_DYNAMODB',
            },
          },
          [
            // file 2: array of datasources
            {
              name: 'foo',
              type: 'AMAZON_DYNAMODB',
            },
            {
              name: 'bar',
              type: 'AMAZON_DYNAMODB',
            },
          ],
        ],
      },
      { region: 'us-east-1' },
      servicePath,
    ),
  ).toMatchSnapshot();
});

test('Schema as string', async () => {
  expect(
    await getConfig(
      {
        authenticationType: 'AWS_IAM',
        schema: 'schema.graphql',
      },
      { region: 'us-east-1' },
      servicePath,
    ),
  ).toMatchSnapshot();
});

test.only('Schema as array', async () => {
  expect(
    await getConfig(
      {
        authenticationType: 'AWS_IAM',
        schema: ['_type_tweet.graphql', '_type_user.graphql'],
      },
      { region: 'us-east-1' },
      servicePath,
    ),
  ).toMatchSnapshot();
});

test('Schema as absolute path', async () => {
  expect(
    await getConfig(
      {
        authenticationType: 'AWS_IAM',
        schema: path.join(servicePath, 'schema.graphql'),
      },
      { region: 'us-east-1' },
      servicePath,
    ),
  ).toMatchSnapshot();
});

test('Schema as glob pattern', async () => {
  expect(
    await getConfig(
      {
        authenticationType: 'AWS_IAM',
        schema: '_type_*.graphql',
      },
      { region: 'us-east-1' },
      servicePath,
    ),
  ).toMatchSnapshot();
});

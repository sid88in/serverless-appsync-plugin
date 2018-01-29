const getConfig = require('./get-config');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'example');

test('authenticationType is missing', () => {
  const run = () => getConfig({}, {}, servicePath);
  expect(run).toThrowErrorMatchingSnapshot();
});

test('serviceRole is missing', () => {
  const run = () =>
    getConfig(
      {
        authenticationType: 'AWS_IAM'
      },
      {},
      servicePath
    );
  expect(run).toThrowErrorMatchingSnapshot();
});

test('returns valid config', () => {
  expect(
    getConfig(
      {
        authenticationType: 'AWS_IAM',
        serviceRole: '1234',
        dataSources: {
          users: {
            type: 'AMAZON_DYNAMODB'
          },
          tweets: {
            type: 'AMAZON_DYNAMODB'
          }
        }
      },
      { region: 'us-east-1' },
      servicePath
    )
  ).toMatchSnapshot();
});

const getConfig = require('./get-config');

test('authenticationType is missing', () => {
  const run = () => getConfig({}, {});
  expect(run).toThrowErrorMatchingSnapshot();
});

test('serviceRole is missing', () => {
  const run = () =>
    getConfig(
      {
        authenticationType: 'AWS_IAM'
      },
      {}
    );
  expect(run).toThrowErrorMatchingSnapshot();
});

test('returns valid config', () => {
  expect(
    getConfig(
      {
        authenticationType: 'AWS_IAM',
        serviceRole: '1234'
      },
      { region: 'us-east-1' }
    )
  ).toMatchSnapshot();
});

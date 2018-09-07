const AWS = require('aws-sdk');
const Koa = require('koa');
const koaPlayground = require('graphql-playground-middleware-koa').default;

const { getServerlessStackName, getValue } = require('./get-stack-value');

function getGraphqlEndpoint(service, provider) {
  return provider
    .request(
      'CloudFormation',
      'describeStacks',
      { StackName: getServerlessStackName(service, provider) },
      provider.getStage(),
      provider.getRegion(),
    )
    .then((result) => {
      const stack = result.Stacks.pop();
      const output = stack.Outputs.find(o => o.OutputKey === 'GraphQlApiUrl');
      if (!output) {
        throw new Error('GraphQlApiUrl: Output not found in serverless stack');
      }

      return output.OutputValue;
    });
}

function getHeaders(service, provider, config, options) {
  if (config.authenticationType === 'AMAZON_COGNITO_USER_POOLS') {
    if (!options.username || !options.password) {
      throw new Error('Username and Password required for authentication type - AMAZON_COGNITO_USER_POOLS');
    }

    return Promise.all([
      getValue(service, provider, config.userPoolConfig.userPoolId, 'userPoolId'),
      getValue(service, provider, config.userPoolConfig.playgroundClientId, 'playgroundClientId'),
    ])
      .then(([UserPoolId, ClientId]) => {
        const cognito = new AWS.CognitoIdentityServiceProvider(provider.getCredentials());
        return cognito
          .adminInitiateAuth({
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            UserPoolId,
            ClientId,
            AuthParameters: {
              USERNAME: options.username,
              PASSWORD: options.password,
            },
          })
          .promise();
      })
      .then(({ AuthenticationResult }) => {
        if (!AuthenticationResult) {
          throw new Error('Authentication Failed');
        }

        return {
          Authorization: AuthenticationResult.IdToken,
        };
      });
  }

  return Promise.reject(new Error(`Authentication Type ${config.authenticationType} Not Supported for Graphiql`));
}

function runGraphqlPlayground(service, provider, config, options) {
  return Promise.all([
    getHeaders(service, provider, config, options),
    getGraphqlEndpoint(service, provider),
  ]).then(([headers, endpoint]) => {
    const app = new Koa();
    app.use(koaPlayground({
      endpoint,
      settings: {
        'editor.cursorShape': 'line',
        'editor.reuseHeaders': true,
      },
      tabs: [{
        endpoint,
        headers,
      }],
    }));

    const port = options.port || 3000;
    app.listen(port);
    const graphiqlUrl = `http://localhost:${port}`;

    return graphiqlUrl;
  });
}

module.exports = runGraphqlPlayground;

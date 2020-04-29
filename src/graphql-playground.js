const AWS = require('aws-sdk');
const Koa = require('koa');
const koaPlayground = require('graphql-playground-middleware-koa').default;

const { getServerlessStackName, getValue } = require('./get-stack-value');

function getOutputValue(provider, key) {
  return provider
    .request(
      'CloudFormation',
      'describeStacks',
      { StackName: getServerlessStackName(provider) },
    )
    .then((result) => {
      const stack = result.Stacks.pop();
      const output = stack.Outputs.find(o => o.OutputKey === key);
      if (!output) {
        throw new Error(`Output ${key}: not found in serverless stack`);
      }

      return output.OutputValue;
    });
}

function getHeaders(provider, config, options) {
  switch (config.authenticationType) {
    case 'AMAZON_COGNITO_USER_POOLS': {
      if (!options.username || !options.password) {
        throw new Error('Username and Password required for authentication type - AMAZON_COGNITO_USER_POOLS');
      }

      return Promise.all([
        getValue(provider, config.userPoolConfig.userPoolId, 'userPoolConfig.userPoolId'),
        getValue(provider, options.clientId || config.userPoolConfig.playgroundClientId, 'userPoolConfig.playgroundClientId'),
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
    case 'API_KEY': {
      return getOutputValue(provider, 'GraphQlApiKeyDefault').then(apiKey => ({
        'X-Api-Key': apiKey,
      }), () => {
        if (options.apiKey) {
          return { 'X-Api-Key': options.apiKey };
        }

        throw new Error('ApiKey required for authentication type (either as GraphQLApiKeyDefault output or as --apiKey option) - API_KEY');
      });
    }
    case 'OPENID_CONNECT': {
      if (!options.jwtToken) {
        throw new Error('jwtToken required for authentication type - OPENID_CONNECT');
      }

      return Promise.resolve({ Authorization: options.jwtToken });
    }
    default:
      throw new Error(`Authentication Type ${config.authenticationType} Not Supported for Graphiql`);
  }
}

function runGraphqlPlayground(provider, config, options) {
  return Promise.all([
    getHeaders(provider, config, options),
    getOutputValue(provider, 'GraphQlApiUrl'),
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

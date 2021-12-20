import { AppSyncConfigInput } from '../../get-config';
import { validateConfig } from '../../validation';
import { basicConfig } from '../basicConfig';

describe('Valdiation', () => {
  describe('Valid', () => {
    const assertions = [
      {
        name: 'Api Key',
        config: {
          ...basicConfig,
          authentication: {
            type: 'API_KEY',
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'Cognito',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AMAZON_COGNITO_USER_POOLS',
            config: {
              userPoolId: '123456',
              awsRegion: 'us-east-1',
              defaultAction: 'ALLOW',
              appIdClientRegex: '.*',
            },
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'Cognito with Refs',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AMAZON_COGNITO_USER_POOLS',
            config: {
              userPoolId: {
                Ref: 'CognitoUserPool',
              },
            },
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'OIDC',
        config: {
          ...basicConfig,
          authentication: {
            type: 'OPENID_CONNECT',
            config: {
              issuer: 'https://auth.example.com',
              clientId: '90941906-004b-4cc5-9685-6864a8e08835',
              iatTTL: 3600,
              authTTL: 3600,
            },
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'IAM',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_IAM',
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'Lambda with functionName',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'myFunction',
              identityValidationExpression: '*',
              authorizerResultTtlInSeconds: 600,
            },
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'Lambda with functionArn',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionArn: 'arn:aws:lambda:...',
            },
          },
        } as AppSyncConfigInput,
      },
    ];

    assertions.forEach((config) => {
      it(`should validate a ${config.name}`, () => {
        expect(validateConfig(config.config)).toBe(true);
      });
    });
  });

  describe('Invalid', () => {
    const assertions = [
      {
        name: 'Cognito missing config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AMAZON_COGNITO_USER_POOLS',
          },
        },
      },
      {
        name: 'Cognito empty config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AMAZON_COGNITO_USER_POOLS',
            config: {},
          },
        },
      },
      {
        name: 'Cognito with invalid userPoolId',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AMAZON_COGNITO_USER_POOLS',
            config: {
              userPoolId: 124,
              awsRegion: 456,
              defaultAction: 'Foo',
              appIdClientRegex: 123,
            },
          },
        },
      },
      {
        name: 'OIDC with missing config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'OPENID_CONNECT',
          },
        },
      },
      {
        name: 'OIDC with empty config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'OPENID_CONNECT',
            config: {},
          },
        },
      },
      {
        name: 'OIDC with invalid config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'OPENID_CONNECT',
            config: {
              issuer: 123,
              clientId: 456,
              iatTTL: 'foo',
              authTTL: 'bar',
            },
          },
        },
      },
      {
        name: 'Lambda with missing config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
          },
        },
      },
      {
        name: 'Lambda with empty config',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {},
          },
        },
      },
      {
        name: 'Lambda with invalid functionName and functionVersion',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 123,
              functionVersion: 123,
              identityValidationExpression: 456,
              authorizerResultTtlInSeconds: 'foo',
            },
          },
        },
      },
      {
        name: 'Lambda with invalid config functionnArn',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionArn: 123,
              identityValidationExpression: 456,
              authorizerResultTtlInSeconds: 'foo',
            },
          },
        },
      },
      {
        name: 'Lambda with invalid config: both functionName and functionnArn are set',
        config: {
          ...basicConfig,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'myFunction',
              functionArn: 'arn:lambda:',
            },
          },
        },
      },
    ];

    assertions.forEach((config) => {
      it(`should validate a ${config.name}`, () => {
        expect(function () {
          validateConfig(config.config);
        }).toThrowErrorMatchingSnapshot();
      });
    });
  });
});

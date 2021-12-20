import { AppSyncConfigInput } from '../get-config';
import { validateConfig } from '../validation';
import { config } from './basicConfig';

describe('Valdiation', () => {
  it('should validate basic config', async () => {
    expect(validateConfig(config)).toMatchInlineSnapshot(`true`);
  });

  describe('Auth', () => {
    const assertions = [
      {
        name: 'Api Key',
        config: {
          ...config,
          authentication: {
            type: 'API_KEY',
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'Cognito',
        config: {
          ...config,
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
          ...config,
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
          ...config,
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
          ...config,
          authentication: {
            type: 'AWS_IAM',
          },
        } as AppSyncConfigInput,
      },
      {
        name: 'Lambda with functionName',
        config: {
          ...config,
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
          ...config,
          authentication: {
            type: 'AWS_LAMBDA',
            config: {
              lambdaFunctionArn: 'arn:aws:lambda:...',
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
});

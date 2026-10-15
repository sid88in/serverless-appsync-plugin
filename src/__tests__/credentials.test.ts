import * as given from './given';

jest.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: () => async () => ({
    accessKeyId: 'DEFAULT_CHAIN',
    secretAccessKey: 'default-chain',
  }),
}));

type CredentialProvider = () => Promise<Record<string, unknown>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveCredentials = (plugin: any): Promise<Record<string, unknown>> =>
  (plugin.clientFactory.credentials as CredentialProvider)();

describe('AWS credentials', () => {
  // osls 4 removed provider.getCredentials(); calling it throws
  // AWS_SDK_V2_SURFACE_REMOVED. Falling back to the default chain would ignore
  // provider.profile and --aws-profile, so the osls-resolved config must win.
  it('uses the credentials osls 4 resolves via getAwsSdkV3Config()', async () => {
    const plugin = given.plugin();
    const identity = { accessKeyId: 'OSLS', secretAccessKey: 'osls' };
    Object.assign(plugin['provider'], {
      getAwsSdkV3Config: jest.fn().mockResolvedValue({
        region: 'eu-west-1',
        credentials: async () => identity,
      }),
      getCredentials: () => {
        throw new Error('AWS_SDK_V2_SURFACE_REMOVED');
      },
    });

    await expect(resolveCredentials(plugin)).resolves.toEqual(identity);
  });

  it('accepts static credentials from getAwsSdkV3Config()', async () => {
    const plugin = given.plugin();
    const identity = { accessKeyId: 'STATIC', secretAccessKey: 'static' };
    Object.assign(plugin['provider'], {
      getAwsSdkV3Config: jest.fn().mockResolvedValue({ credentials: identity }),
    });

    await expect(resolveCredentials(plugin)).resolves.toEqual(identity);
  });

  it('uses getCredentials() on Serverless 3 / osls 3', async () => {
    const plugin = given.plugin();
    Object.assign(plugin['provider'], {
      getCredentials: () => ({
        credentials: { accessKeyId: 'SLS3', secretAccessKey: 'sls3' },
      }),
    });

    await expect(resolveCredentials(plugin)).resolves.toMatchObject({
      accessKeyId: 'SLS3',
      secretAccessKey: 'sls3',
    });
  });
});

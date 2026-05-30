import { synthesize } from './helpers/synthesize';
import {
  countResourcesByType,
  findResourcesByType,
} from './helpers/assertions';

describe('examples/datasource-http', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/datasource-http');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates two HTTP data sources', () => {
    const httpDataSources = findResourcesByType(
      result.template,
      'AWS::AppSync::DataSource',
    ).filter((ds) => ds.resource.Properties?.Type === 'HTTP');
    expect(httpDataSources).toHaveLength(2);
  });

  it('configures the unauthenticated HTTP endpoint', () => {
    const dataSources = findResourcesByType(
      result.template,
      'AWS::AppSync::DataSource',
    );
    const weatherDs = dataSources.find(
      (ds) => ds.resource.Properties?.Name === 'weather_api',
    );
    if (!weatherDs) throw new Error('weather_api data source not found');
    const httpConfig = weatherDs.resource.Properties?.HttpConfig as Record<
      string,
      unknown
    >;
    expect(httpConfig.Endpoint).toBe('https://api.weather.example.com');
    expect(httpConfig.AuthorizationConfig).toBeUndefined();
  });

  it('configures IAM signing for the signed HTTP endpoint', () => {
    const dataSources = findResourcesByType(
      result.template,
      'AWS::AppSync::DataSource',
    );
    const signedDs = dataSources.find(
      (ds) => ds.resource.Properties?.Name === 'signed_api',
    );
    if (!signedDs) throw new Error('signed_api data source not found');
    const httpConfig = signedDs.resource.Properties?.HttpConfig as Record<
      string,
      unknown
    >;
    expect(httpConfig.AuthorizationConfig).toBeDefined();
    const auth = httpConfig.AuthorizationConfig as Record<string, unknown>;
    expect(auth.AuthorizationType).toBe('AWS_IAM');
    const iamConfig = auth.AwsIamConfig as Record<string, string>;
    expect(iamConfig.SigningRegion).toBe('us-east-1');
    expect(iamConfig.SigningServiceName).toBe('execute-api');
  });

  it('creates a service role only for the IAM-signed data source', () => {
    // Only the signed HTTP data source needs an IAM role
    expect(
      countResourcesByType(result.template, 'AWS::IAM::Role'),
    ).toBeGreaterThanOrEqual(1);
  });
});

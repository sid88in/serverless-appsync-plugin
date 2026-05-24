import { synthesize } from './helpers/synthesize';
import { findOneResourceByType } from './helpers/assertions';

describe('examples/custom-domain', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/custom-domain');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('creates an AppSync DomainName resource', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::AppSync::DomainName',
    );
    const props = resource.Properties as Record<string, unknown>;
    expect(props.DomainName).toBe('api.example.com');
    expect(props.CertificateArn).toBeDefined();
  });

  it('creates a DomainNameApiAssociation', () => {
    findOneResourceByType(
      result.template,
      'AWS::AppSync::DomainNameApiAssociation',
    );
  });

  it('creates a Route 53 record for the custom domain', () => {
    const { resource } = findOneResourceByType(
      result.template,
      'AWS::Route53::RecordSet',
    );
    const props = resource.Properties as Record<string, unknown>;
    expect(props.HostedZoneId).toBe('Z1234567890ABC');
  });
});

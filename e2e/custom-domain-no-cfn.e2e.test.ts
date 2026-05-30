import { synthesize } from './helpers/synthesize';
import { countResourcesByType, getGraphQlApi } from './helpers/assertions';

describe('examples/custom-domain-no-cfn', () => {
  let result: ReturnType<typeof synthesize>;

  beforeAll(() => {
    result = synthesize('examples/custom-domain-no-cfn');
  });

  afterAll(() => {
    result.cleanup();
  });

  it('still creates the GraphQLApi (domain is independent of API)', () => {
    const { resource } = getGraphQlApi(result.template);
    expect(resource.Properties?.Name).toBe('custom-domain-no-cfn');
  });

  it('does NOT create an AWS::AppSync::DomainName resource', () => {
    expect(
      countResourcesByType(result.template, 'AWS::AppSync::DomainName'),
    ).toBe(0);
  });

  it('does NOT create an AWS::AppSync::DomainNameApiAssociation resource', () => {
    expect(
      countResourcesByType(
        result.template,
        'AWS::AppSync::DomainNameApiAssociation',
      ),
    ).toBe(0);
  });

  it('does NOT create an AWS::Route53::RecordSet resource', () => {
    expect(
      countResourcesByType(result.template, 'AWS::Route53::RecordSet'),
    ).toBe(0);
  });

  it('does NOT create an AWS::CertificateManager::Certificate resource', () => {
    expect(
      countResourcesByType(
        result.template,
        'AWS::CertificateManager::Certificate',
      ),
    ).toBe(0);
  });
});

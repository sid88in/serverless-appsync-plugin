/**
 * Tier D (custom domain — heaviest): exercises the domain/Route53/ACM code
 * paths. Gated behind a provided domain + hosted zone (and, by default, left
 * fully skipped). When enabled it requires:
 *
 *   APPSYNC_PLUGIN_INTEGRATION_DOMAIN          e.g. it.example.com
 *   APPSYNC_PLUGIN_INTEGRATION_HOSTED_ZONE_ID  the Route53 zone for that domain
 *   APPSYNC_PLUGIN_INTEGRATION_CERT_ARN        (optional) an ISSUED us-east-1
 *                                              ACM cert; if omitted, the plugin
 *                                              discovers one via ListCertificates
 *
 * Covers (in order, with reverse-order teardown):
 *   - appsync domain create        -> ListCertificates (ACM, us-east-1 pin) + CreateDomainName
 *   - appsync domain assoc         -> GetApiAssociation (incl. NotFoundException path) + AssociateApi
 *   - appsync domain create-record -> GetDomainName + ListHostedZonesByName + ChangeResourceRecordSets + GetChange (poll to INSYNC)
 *   - appsync domain delete-record -> ChangeResourceRecordSets (DELETE) + GetChange
 *   - appsync domain disassoc      -> DisassociateApi
 *   - appsync domain delete        -> DeleteDomainName
 *
 * The ACM certificate is reused, never created, so it is never deleted.
 */
import { domainDescribe, integrationConfig } from './helpers/gate';
import { generateRunId } from './helpers/run-id';
import { prepareProject, PreparedProject } from './helpers/project';
import { deploy, remove, appsync } from './helpers/sls';
import { cleanupDomainName } from './helpers/aws';

const DEPLOY_TIMEOUT = 900_000;
const DOMAIN_TIMEOUT = 600_000; // create-record polls GetChange to INSYNC

domainDescribe('integration / Tier D — custom domain + Route53 + ACM', () => {
  let project: PreparedProject;
  const domainName = integrationConfig.domain.name as string;

  beforeAll(async () => {
    project = prepareProject({
      runId: generateRunId(),
      region: integrationConfig.region,
      domain: {
        name: domainName,
        hostedZoneId: integrationConfig.domain.hostedZoneId,
        certificateArn: integrationConfig.domain.certificateArn,
      },
    });
    deploy({ cwd: project.dir });
  }, DEPLOY_TIMEOUT);

  afterAll(async () => {
    if (!project) {
      return;
    }
    // Reverse-order teardown of the non-CloudFormation domain resources, then
    // the stack. Each step is best-effort; the sweeper is the final backstop.
    for (const step of [
      () => appsync(['domain', 'delete-record', '--yes'], { cwd: project.dir }),
      () => appsync(['domain', 'disassoc', '--yes'], { cwd: project.dir }),
      () =>
        appsync(['domain', 'delete', '--yes', '--quiet'], { cwd: project.dir }),
    ]) {
      try {
        step();
      } catch {
        // continue
      }
    }
    try {
      await cleanupDomainName(integrationConfig.region, domainName);
    } catch {
      // continue
    }
    try {
      remove({ cwd: project.dir });
    } catch {
      // sweeper backstop
    }
    project.cleanup();
  }, DEPLOY_TIMEOUT);

  it(
    'creates the domain (ListCertificates us-east-1 + CreateDomainName)',
    () => {
      const { stdout } = appsync(['domain', 'create', '--yes'], {
        cwd: project.dir,
      });
      expect(stdout.toLowerCase()).toContain('created successfully');
    },
    DOMAIN_TIMEOUT,
  );

  it(
    'associates the API with the domain (AssociateApi)',
    () => {
      const { stdout } = appsync(['domain', 'assoc', '--yes'], {
        cwd: project.dir,
      });
      expect(stdout.toLowerCase()).toContain('associated');
    },
    DOMAIN_TIMEOUT,
  );

  it(
    'creates the Route53 alias record (ChangeResourceRecordSets + GetChange poll)',
    () => {
      const { stdout } = appsync(['domain', 'create-record', '--yes'], {
        cwd: project.dir,
      });
      expect(stdout.toLowerCase()).toContain('record created');
    },
    DOMAIN_TIMEOUT,
  );
});

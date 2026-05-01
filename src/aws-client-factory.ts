import { AppSyncClient } from '@aws-sdk/client-appsync';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ACMClient } from '@aws-sdk/client-acm';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';

// ACM certificates for CloudFront must always be in us-east-1
const ACM_REGION = 'us-east-1';

/**
 * AWS credentials accepted by SDK v3 clients.
 * Either a static credential object or an AwsCredentialIdentityProvider function.
 */
export type AwsCredentials =
  | {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    }
  | AwsCredentialIdentityProvider;

/**
 * Centralized factory for creating and caching AWS SDK v3 clients.
 * Clients are lazily initialized on first access and reused across calls.
 */
export class AwsClientFactory {
  private appSyncClient?: AppSyncClient;
  private cloudFormationClient?: CloudFormationClient;
  private cloudWatchLogsClient?: CloudWatchLogsClient;
  private route53Client?: Route53Client;
  private acmClient?: ACMClient;

  constructor(
    private readonly region: string,
    private readonly credentials: AwsCredentials,
  ) {}

  getAppSyncClient(): AppSyncClient {
    if (!this.appSyncClient) {
      this.appSyncClient = new AppSyncClient({
        region: this.region,
        credentials: this.credentials,
      });
    }
    return this.appSyncClient;
  }

  getCloudFormationClient(): CloudFormationClient {
    if (!this.cloudFormationClient) {
      this.cloudFormationClient = new CloudFormationClient({
        region: this.region,
        credentials: this.credentials,
      });
    }
    return this.cloudFormationClient;
  }

  getCloudWatchLogsClient(): CloudWatchLogsClient {
    if (!this.cloudWatchLogsClient) {
      this.cloudWatchLogsClient = new CloudWatchLogsClient({
        region: this.region,
        credentials: this.credentials,
      });
    }
    return this.cloudWatchLogsClient;
  }

  getRoute53Client(): Route53Client {
    if (!this.route53Client) {
      this.route53Client = new Route53Client({
        region: this.region,
        credentials: this.credentials,
      });
    }
    return this.route53Client;
  }

  /**
   * ACM client always uses us-east-1, regardless of the configured region.
   * This is required because ACM certificates for CloudFront must be in us-east-1.
   */
  getAcmClient(): ACMClient {
    if (!this.acmClient) {
      this.acmClient = new ACMClient({
        region: ACM_REGION,
        credentials: this.credentials,
      });
    }
    return this.acmClient;
  }
}

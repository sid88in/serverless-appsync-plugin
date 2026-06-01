import Serverless from 'serverless/lib/Serverless';
import Provider from 'serverless/lib/plugins/aws/provider.js';
import { forEach, last, merge } from 'lodash';
import { getAppSyncConfig } from './getAppSyncConfig';
import { GraphQLError } from 'graphql';
import { DateTime } from 'luxon';
import chalk from 'chalk';
import path from 'path';
import open from 'open';
import fs from 'fs';
import {
  CommandsDefinition,
  Hook,
  VariablesSourcesDefinition,
  VariableSourceResolver,
} from 'serverless';
import { AppSyncValidationError, validateConfig } from './validation';
import {
  confirmAction,
  getHostedZoneName,
  getWildCardDomainName,
  parseDateTimeOrDuration,
  wait,
} from './utils';
import { Api } from './resources/Api';
import { Naming } from './resources/Naming';
import { buildSync } from 'esbuild';
import terminalLink from 'terminal-link';
import { AwsClientFactory, AwsCredentials } from './aws-client-factory';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import {
  GetGraphqlApiCommand,
  ListApiKeysCommand,
  GetIntrospectionSchemaCommand,
  FlushApiCacheCommand,
  CreateDomainNameCommand,
  DeleteDomainNameCommand,
  GetApiAssociationCommand,
  AssociateApiCommand,
  DisassociateApiCommand,
  GetDomainNameCommand,
  EvaluateCodeCommand,
  EvaluateMappingTemplateCommand,
  GetGraphqlApiEnvironmentVariablesCommand,
  PutGraphqlApiEnvironmentVariablesCommand,
  RuntimeName,
} from '@aws-sdk/client-appsync';
import { DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import { FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import {
  ListHostedZonesByNameCommand,
  ChangeResourceRecordSetsCommand,
  GetChangeCommand,
} from '@aws-sdk/client-route-53';
import { ListCertificatesCommand } from '@aws-sdk/client-acm';

const CONSOLE_BASE_URL = 'https://console.aws.amazon.com';

/**
 * Build an AWS SDK v3 credential provider from the credentials the Serverless
 * Framework resolves for this service (default profile, provider.profile,
 * environment credentials, --aws-profile, etc.), so the live commands use the
 * same identity the Framework uses for deploys instead of the bare default
 * chain. Resolution is fully lazy: the Framework's `getCredentials()` is only
 * consulted when a client actually makes a request, so credential-free commands
 * (eg: package / offline synthesis) never trigger it. The Framework returns an
 * aws-sdk (v2) credentials object which may itself resolve lazily (shared-ini,
 * SSO, assume-role, MFA), so we await it. If the Framework resolves no explicit
 * credentials (or resolution fails), we defer to the standard v3 default chain.
 */
const resolveCredentials = (provider: Provider): AwsCredentials => {
  return async () => {
    let credentials;
    try {
      ({ credentials } = provider.getCredentials());
    } catch {
      // Credential resolution can throw in minimal/standalone contexts; fall
      // back to the default chain rather than crashing the command.
      credentials = undefined;
    }
    if (!credentials) {
      return fromNodeProviderChain()();
    }
    if (typeof credentials.getPromise === 'function') {
      await credentials.getPromise();
    }
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      // Serverless returned a credentials object but it could not be resolved
      // to concrete keys; defer to the default chain rather than handing the
      // SDK an empty identity.
      return fromNodeProviderChain()();
    }
    return {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      expiration: credentials.expireTime
        ? new Date(credentials.expireTime)
        : undefined,
    };
  };
};

type Progress = {
  remove: () => void;
};

type ServerlessPluginUtils = {
  log: {
    success: (message: string) => void;
    warning: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  progress: {
    create: (params: { name?: string; message: string }) => Progress;
  };
  writeText: (message: string) => void;
};

class ServerlessAppsyncPlugin {
  private provider: Provider;
  private clientFactory: AwsClientFactory;
  private gatheredData: {
    apis: {
      id: string;
      type: string;
      uri: string;
    }[];
    apiKeys: {
      value: string;
      description?: string;
    }[];
  };
  public readonly hooks: Record<string, Hook>;
  public readonly commands?: CommandsDefinition;
  public readonly configurationVariablesSources?: VariablesSourcesDefinition;
  private api?: Api;
  private naming?: Naming;

  constructor(
    public serverless: Serverless,
    private options: Record<string, string>,
    public utils: ServerlessPluginUtils,
  ) {
    this.gatheredData = {
      apis: [],
      apiKeys: [],
    };
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.utils = utils;

    // Resolve region and credentials the same way the Serverless Framework
    // does for its own AWS calls, so the live commands honor the --region /
    // --aws-profile CLI options, provider.region / provider.profile from the
    // service config, and any assumed-role / environment credentials. Falling
    // back to the bare default credential chain (as a plain
    // `fromNodeProviderChain()` would) silently ignores all of the above and
    // breaks profile-based and multi-account setups.
    const region = this.provider.getRegion();
    const credentials = resolveCredentials(this.provider);
    this.clientFactory = new AwsClientFactory(region, credentials);
    // We are using a newer version of AJV than Serverless Framework
    // and some customizations (eg: custom errors, $merge, filter irrelevant errors)
    // For SF, just validate the type of input to allow us to use a custom
    // field (ie: `appSync`). Actual validation will be handled by this plugin
    // later in `validateConfig()`
    this.serverless.configSchemaHandler.defineTopLevelProperty('appSync', {
      type: 'object',
    });

    this.configurationVariablesSources = {
      appsync: {
        resolve: this.resolveVariable,
      },
    };

    this.commands = {
      appsync: {
        usage: 'Manage the AppSync API',
        commands: {
          'validate-schema': {
            usage: 'Validate the graphql schema',
            lifecycleEvents: ['run'],
          },
          'get-introspection': {
            usage: "Get the API's introspection schema",
            lifecycleEvents: ['run'],
            options: {
              format: {
                usage:
                  'Specify the output format (JSON or SDL). Default: `JSON`',
                shortcut: 'f',
                required: false,
                type: 'string',
              },
              output: {
                usage: 'Output to a file. If not specified, writes to stdout',
                shortcut: 'o',
                required: false,
                type: 'string',
              },
            },
          },
          'flush-cache': {
            usage: 'Flushes the cache of the API.',
            lifecycleEvents: ['run'],
          },
          console: {
            usage: 'Open the AppSync AWS console',
            lifecycleEvents: ['run'],
          },
          cloudwatch: {
            usage: 'Open the CloudWatch AWS console',
            lifecycleEvents: ['run'],
          },
          logs: {
            usage: 'Output the logs of the AppSync API to stdout',
            lifecycleEvents: ['run'],
            options: {
              startTime: {
                usage: 'Starting time. Default: 10m (10 minutes ago)',
                required: false,
                type: 'string',
              },
              tail: {
                usage: 'Tail the log output',
                shortcut: 't',
                required: false,
                type: 'boolean',
              },
              interval: {
                usage: 'Tail polling interval in milliseconds. Default: `1000`',
                shortcut: 'i',
                required: false,
                type: 'string',
              },
              filter: {
                usage: 'A filter pattern to apply to the logs',
                shortcut: 'f',
                required: false,
                type: 'string',
              },
            },
          },
          evaluate: {
            usage: 'Evaluate a resolver or mapping template against a context',
            lifecycleEvents: ['run'],
            options: {
              type: {
                usage: 'GraphQL type (e.g. Query)',
                shortcut: 't',
                required: false,
                type: 'string',
              },
              field: {
                usage: 'GraphQL field (e.g. getUser)',
                shortcut: 'f',
                required: false,
                type: 'string',
              },
              function: {
                usage: 'Function to evaluate: request or response',
                required: false,
                type: 'string',
              },
              template: {
                usage: 'Path to a VTL mapping template file',
                required: false,
                type: 'string',
              },
              context: {
                usage:
                  'Path to a JSON file with the evaluation context, or inline JSON string',
                shortcut: 'c',
                required: false,
                type: 'string',
              },
            },
          },
          env: {
            usage: 'Manage AppSync API environment variables',
            commands: {
              get: {
                usage: 'Get all environment variables of the deployed API',
                lifecycleEvents: ['run'],
              },
              set: {
                usage:
                  'Set (replace all) environment variables of the deployed API',
                lifecycleEvents: ['run'],
                options: {
                  key: {
                    usage: 'Environment variable key',
                    shortcut: 'k',
                    required: true,
                    type: 'string',
                  },
                  value: {
                    usage: 'Environment variable value',
                    shortcut: 'v',
                    required: true,
                    type: 'string',
                  },
                },
              },
            },
          },
          domain: {
            usage: 'Manage the domain for this AppSync API',
            commands: {
              create: {
                usage: 'Create the domain in AppSync',
                lifecycleEvents: ['run'],
                options: {
                  quiet: {
                    usage: "Don't return an error if the domain already exists",
                    shortcut: 'q',
                    required: false,
                    type: 'boolean',
                  },
                  yes: {
                    usage: 'Automatic yes to prompts',
                    shortcut: 'y',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
              delete: {
                usage: 'Delete the domain from AppSync',
                lifecycleEvents: ['run'],
                options: {
                  quiet: {
                    usage: "Don't return an error if the domain does not exist",
                    shortcut: 'q',
                    required: false,
                    type: 'boolean',
                  },
                  yes: {
                    usage: 'Automatic yes to prompts',
                    shortcut: 'y',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
              'create-record': {
                usage: 'Create the Alias record for this domain in Route53',
                lifecycleEvents: ['run'],
                options: {
                  quiet: {
                    usage: "Don't return an error if the record already exists",
                    shortcut: 'q',
                    required: false,
                    type: 'boolean',
                  },
                  yes: {
                    usage: 'Automatic yes to prompts',
                    shortcut: 'y',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
              'delete-record': {
                usage: 'Deletes the Alias record for this domain from Route53',
                lifecycleEvents: ['run'],
                options: {
                  quiet: {
                    usage: "Don't return an error if the record does not exist",
                    shortcut: 'q',
                    required: false,
                    type: 'boolean',
                  },
                  yes: {
                    usage: 'Automatic yes to prompts',
                    shortcut: 'y',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
              assoc: {
                usage: 'Associate this AppSync API with the domain',
                lifecycleEvents: ['run'],
                options: {
                  yes: {
                    usage: 'Automatic yes to prompts',
                    shortcut: 'y',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
              disassoc: {
                usage: 'Disassociate the AppSync API associated to the domain',
                lifecycleEvents: ['run'],
                options: {
                  yes: {
                    usage: 'Automatic yes to prompts',
                    shortcut: 'y',
                    required: false,
                    type: 'boolean',
                  },
                  force: {
                    usage:
                      'Force the disassociation of *any* API from this domain',
                    shortcut: 'f',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'after:aws:info:gatherData': () => this.gatherData(),
      'after:aws:info:displayServiceInfo': () => {
        this.displayEndpoints();
        this.displayApiKeys();
      },
      // Commands
      'appsync:validate-schema:run': () => {
        this.loadConfig();
        this.validateSchemas();
        this.utils.log.success('AppSync schema valid');
      },
      'appsync:get-introspection:run': () => this.getIntrospection(),
      'appsync:flush-cache:run': () => this.flushCache(),
      'appsync:console:run': () => this.openConsole(),
      'appsync:cloudwatch:run': () => this.openCloudWatch(),
      'appsync:logs:run': async () => this.initShowLogs(),
      'appsync:evaluate:run': async () => this.evaluateResolver(),
      'appsync:env:get:run': async () => this.envGet(),
      'appsync:env:set:run': async () => this.envSet(),
      'before:appsync:domain:create:run': async () => this.initDomainCommand(),
      'appsync:domain:create:run': async () => this.createDomain(),
      'before:appsync:domain:delete:run': async () => this.initDomainCommand(),
      'appsync:domain:delete:run': async () => this.deleteDomain(),
      'before:appsync:domain:assoc:run': async () => this.initDomainCommand(),
      'appsync:domain:assoc:run': async () => this.assocDomain(),
      'before:appsync:domain:disassoc:run': async () =>
        this.initDomainCommand(),
      'appsync:domain:disassoc:run': async () => this.disassocDomain(),
      'before:appsync:domain:create-record:run': async () =>
        this.initDomainCommand(),
      'appsync:domain:create-record:run': async () => this.createRecord(),
      'before:appsync:domain:delete-record:run': async () =>
        this.initDomainCommand(),
      'appsync:domain:delete-record:run': async () => this.deleteRecord(),
      finalize: () => {
        this.utils.writeText(
          '\nLooking for a better AppSync development experience? Have you tried GraphBolt? https://graphbolt.dev',
        );
      },
    };

    // These hooks need the config to be loaded and
    // processed in order to add embedded functions
    // to the service. (eg: function defined in resolvers)
    [
      'before:logs:logs',
      'before:deploy:function:initialize',
      'before:package:initialize',
      'before:aws:info:gatherData',
    ].forEach((hook) => {
      this.hooks[hook] = () => {
        this.loadConfig();
        this.buildAndAppendResources();
      };
    });
  }

  async getApiId() {
    this.loadConfig();

    if (!this.naming) {
      throw new this.serverless.classes.Error(
        'Could not find the naming service. This should not happen.',
      );
    }

    const logicalIdGraphQLApi = this.naming.getApiLogicalId();

    const { StackResources } = await this.clientFactory
      .getCloudFormationClient()
      .send(
        new DescribeStackResourcesCommand({
          StackName: this.provider.naming.getStackName(),
          LogicalResourceId: logicalIdGraphQLApi,
        }),
      );

    const apiId = last(StackResources?.[0]?.PhysicalResourceId?.split('/')) as
      | string
      | undefined;

    if (!apiId) {
      throw new this.serverless.classes.Error(
        'AppSync Api not found in stack. Did you forget to deploy?',
      );
    }

    return apiId;
  }

  async gatherData() {
    const apiId = await this.getApiId();

    const { graphqlApi } = await this.clientFactory
      .getAppSyncClient()
      .send(new GetGraphqlApiCommand({ apiId }));

    forEach(graphqlApi?.uris, (value, type) => {
      this.gatheredData.apis.push({
        id: apiId,
        type: type.toLowerCase(),
        uri: value,
      });
    });

    const { apiKeys } = await this.clientFactory
      .getAppSyncClient()
      .send(new ListApiKeysCommand({ apiId }));

    apiKeys?.forEach((apiKey) => {
      this.gatheredData.apiKeys.push({
        value: apiKey.id || 'unknown key',
        description: apiKey.description,
      });
    });
  }

  async getIntrospection() {
    const apiId = await this.getApiId();

    const { schema } = await this.clientFactory.getAppSyncClient().send(
      new GetIntrospectionSchemaCommand({
        apiId,
        format: (this.options.format || 'JSON').toUpperCase() as 'JSON' | 'SDL',
      }),
    );

    if (!schema) {
      throw new this.serverless.classes.Error('Schema not found');
    }

    if (this.options.output) {
      try {
        const filePath = path.resolve(this.options.output);
        fs.writeFileSync(filePath, Buffer.from(schema).toString());
        this.utils.log.success(`Introspection schema exported to ${filePath}`);
      } catch (error) {
        this.utils.log.error(
          `Could not save to file: ${(error as Error).message}`,
        );
      }
      return;
    }

    this.utils.writeText(Buffer.from(schema).toString());
  }

  async flushCache() {
    const apiId = await this.getApiId();
    await this.clientFactory
      .getAppSyncClient()
      .send(new FlushApiCacheCommand({ apiId }));
    this.utils.log.success('Cache flushed successfully');
  }

  async openConsole() {
    const apiId = await this.getApiId();
    const { region } = this.serverless.service.provider;
    const url = `${CONSOLE_BASE_URL}/appsync/home?region=${region}#/${apiId}/v1/home`;
    open(url);
  }

  async openCloudWatch() {
    const apiId = await this.getApiId();
    const { region } = this.serverless.service.provider;
    const url = `${CONSOLE_BASE_URL}/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/$252Faws$252Fappsync$252Fapis$252F${apiId}`;
    open(url);
  }

  async initShowLogs() {
    const apiId = await this.getApiId();
    await this.showLogs(`/aws/appsync/apis/${apiId}`);
  }

  async showLogs(logGroupName: string, nextToken?: string) {
    let startTime: DateTime;
    if (this.options.startTime) {
      startTime = parseDateTimeOrDuration(this.options.startTime);
    } else {
      startTime = DateTime.now().minus({ minutes: 10 });
    }

    const { events, nextToken: newNextToken } = await this.clientFactory
      .getCloudWatchLogsClient()
      .send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime: startTime.toMillis(),
          nextToken,
          filterPattern: this.options.filter,
        }),
      );

    events?.forEach((event) => {
      const { timestamp, message } = event;
      this.utils.writeText(
        `${chalk.gray(
          DateTime.fromMillis(timestamp || 0).toISO(),
        )}\t${message}`,
      );
    });

    const lastTs = (last(events) as any)?.timestamp;
    this.options.startTime = lastTs
      ? DateTime.fromMillis(lastTs + 1).toISO()
      : this.options.startTime;

    if (this.options.tail) {
      const interval = this.options.interval
        ? parseInt(this.options.interval, 10)
        : 1000;
      await wait(interval);
      await this.showLogs(logGroupName, newNextToken);
    }
  }

  async initDomainCommand() {
    this.loadConfig();
    const domain = this.getDomain();

    if (domain.useCloudFormation !== false) {
      this.utils.log.warning(
        'You are using the CloudFormation integration for domain configuration.\n' +
          'To avoid CloudFormation drifts, you should not use it in combination with this command.\n' +
          'Set the `domain.useCloudFormation` attribute to false to use the CLI integration.\n' +
          'If you have already deployed using CloudFormation and would like to switch to using the CLI, you can ' +
          terminalLink(
            'eject from CloudFormation',
            'https://github.com/sid88in/serverless-appsync-plugin/blob/master/doc/custom-domain.md#ejecting-from-cloudformation',
          ) +
          ' first.',
      );

      if (!this.options.yes && !(await confirmAction())) {
        process.exit(0);
      }
    }
  }

  getDomain() {
    if (!this.api) {
      throw new this.serverless.classes.Error(
        'AppSync configuration not found',
      );
    }

    const { domain } = this.api.config;
    if (!domain) {
      throw new this.serverless.classes.Error('Domain configuration not found');
    }

    return domain;
  }

  async getDomainCertificateArn() {
    const { CertificateSummaryList } = await this.clientFactory
      .getAcmClient()
      .send(
        new ListCertificatesCommand({
          // only fully issued certificates
          CertificateStatuses: ['ISSUED'],
        }),
      );

    const domain = this.getDomain();

    // try to find an exact match certificate
    // fallback on wildcard
    const matches = [domain.name, getWildCardDomainName(domain.name)];
    for (const match of matches) {
      const cert = CertificateSummaryList?.find(
        ({ DomainName }) => DomainName === match,
      );
      if (cert) {
        this.utils.log.info(
          `Found matching certificate for ${match}: ${cert.CertificateArn}`,
        );
        return cert.CertificateArn;
      }
    }
  }

  async createDomain() {
    try {
      const domain = this.getDomain();
      const certificateArn =
        domain.certificateArn || (await this.getDomainCertificateArn());

      if (!certificateArn) {
        throw new this.serverless.classes.Error(
          `No certificate found for domain ${domain.name}.`,
        );
      }

      if (typeof certificateArn !== 'string') {
        throw new this.serverless.classes.Error(
          `Invalid \`certificateArn\`: the \`appsync domain\` CLI commands require a plain ARN string. ` +
            `CloudFormation intrinsic functions (e.g. Fn::ImportValue) can only be resolved by CloudFormation, not by the CLI. ` +
            `Either pass a literal ARN, or manage the domain through CloudFormation (the default, \`domain.useCloudFormation: true\`), where the intrinsic function will be resolved.`,
        );
      }

      await this.clientFactory.getAppSyncClient().send(
        new CreateDomainNameCommand({
          domainName: domain.name,
          certificateArn,
        }),
      );
      this.utils.log.success(`Domain '${domain.name}' created successfully`);
    } catch (error) {
      if (error instanceof Error && this.options.quiet) {
        this.utils.log.error(error.message);
      } else {
        throw error;
      }
    }
  }

  async deleteDomain() {
    try {
      const domain = this.getDomain();
      this.utils.log.warning(`The domain '${domain.name} will be deleted.`);
      if (!this.options.yes && !(await confirmAction())) {
        return;
      }
      await this.clientFactory
        .getAppSyncClient()
        .send(new DeleteDomainNameCommand({ domainName: domain.name }));
      this.utils.log.success(`Domain '${domain.name}' deleted successfully`);
    } catch (error) {
      if (error instanceof Error && this.options.quiet) {
        this.utils.log.error(error.message);
      } else {
        throw error;
      }
    }
  }

  async getApiAssocStatus(name: string) {
    try {
      const result = await this.clientFactory
        .getAppSyncClient()
        .send(new GetApiAssociationCommand({ domainName: name }));
      return result.apiAssociation as
        | { associationStatus?: string; apiId?: string }
        | undefined;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundException') {
        return { associationStatus: 'NOT_FOUND' } as {
          associationStatus?: string;
          apiId?: string;
        };
      }
      throw error;
    }
  }

  async showApiAssocStatus({
    name,
    message,
    desiredStatus,
  }: {
    name: string;
    message: string;
    desiredStatus: 'SUCCESS' | 'NOT_FOUND';
  }) {
    const progressInstance = this.utils.progress.create({ message });
    let status: string;
    do {
      status =
        (await this.getApiAssocStatus(name))?.associationStatus || 'UNKNOWN';
      if (status !== desiredStatus) {
        await wait(1000);
      }
    } while (status !== desiredStatus);

    progressInstance.remove();
  }

  async assocDomain() {
    const domain = this.getDomain();
    const apiId = await this.getApiId();
    const assoc = await this.getApiAssocStatus(domain.name);

    if (assoc?.associationStatus !== 'NOT_FOUND' && assoc?.apiId !== apiId) {
      this.utils.log.warning(
        `The domain ${domain.name} is currently associated to another API (${assoc?.apiId})`,
      );
      if (!this.options.yes && !(await confirmAction())) {
        return;
      }
    } else if (assoc?.apiId === apiId) {
      this.utils.log.success('The domain is already associated to this API');
      return;
    }

    await this.clientFactory.getAppSyncClient().send(
      new AssociateApiCommand({
        domainName: domain.name,
        apiId,
      }),
    );

    const message = `Associating API with domain '${domain.name}'`;
    await this.showApiAssocStatus({
      name: domain.name,
      message,
      desiredStatus: 'SUCCESS',
    });
    this.utils.log.success(
      `API successfully associated to domain '${domain.name}'`,
    );
  }

  async disassocDomain() {
    const domain = this.getDomain();
    const apiId = await this.getApiId();
    const assoc = await this.getApiAssocStatus(domain.name);

    if (assoc?.associationStatus === 'NOT_FOUND') {
      this.utils.log.warning(
        `The domain ${domain.name} is currently not associated to any API`,
      );
      return;
    }

    if (assoc?.apiId !== apiId && !this.options.force) {
      throw new this.serverless.classes.Error(
        `The domain ${domain.name} is currently associated to another API (${assoc?.apiId})\n` +
          `Try running this command from that API's stack or stage, or use the --force / -f flag`,
      );
    }
    this.utils.log.warning(
      `The domain ${domain.name} will be disassociated from API '${apiId}'`,
    );

    if (!this.options.yes && !(await confirmAction())) {
      return;
    }

    await this.clientFactory
      .getAppSyncClient()
      .send(new DisassociateApiCommand({ domainName: domain.name }));

    const message = `Disassociating API from domain '${domain.name}'`;
    await this.showApiAssocStatus({
      name: domain.name,
      message,
      desiredStatus: 'NOT_FOUND',
    });

    this.utils.log.success(
      `API successfully disassociated from domain '${domain.name}'`,
    );
  }

  async getHostedZoneId() {
    const domain = this.getDomain();
    if (domain.hostedZoneId) {
      return domain.hostedZoneId;
    } else {
      const { HostedZones } = await this.clientFactory
        .getRoute53Client()
        .send(new ListHostedZonesByNameCommand({}));
      const hostedZoneName =
        domain.hostedZoneName || getHostedZoneName(domain.name);
      const foundHostedZone = HostedZones?.find(
        (zone) => zone.Name === hostedZoneName,
      )?.Id;
      if (!foundHostedZone) {
        throw new this.serverless.classes.Error(
          `No hosted zone found for domain ${domain.name}`,
        );
      }
      return foundHostedZone.replace('/hostedzone/', '');
    }
  }

  async getAppSyncDomainName() {
    const domain = this.getDomain();
    const { domainNameConfig } = await this.clientFactory
      .getAppSyncClient()
      .send(new GetDomainNameCommand({ domainName: domain.name }));

    const { hostedZoneId, appsyncDomainName: dnsName } = domainNameConfig || {};
    if (!hostedZoneId || !dnsName) {
      throw new this.serverless.classes.Error(
        `Domain ${domain.name} not found\nDid you forget to run 'sls appsync domain create'?`,
      );
    }

    return { hostedZoneId, dnsName };
  }

  async createRecord() {
    const progressInstance = this.utils.progress.create({
      message: 'Creating route53 record',
    });

    const domain = this.getDomain();
    const appsyncDomainName = await this.getAppSyncDomainName();
    const hostedZoneId = await this.getHostedZoneId();
    const changeId = await this.changeRoute53Record(
      'CREATE',
      hostedZoneId,
      appsyncDomainName,
    );
    if (changeId) {
      await this.checkRoute53RecordStatus(changeId);
      progressInstance.remove();
      this.utils.log.info(
        `Alias record for '${domain.name}' was created in Hosted Zone '${hostedZoneId}'`,
      );
      this.utils.log.success('Route53 record created successfuly');
    }
  }

  async deleteRecord() {
    const domain = this.getDomain();
    const appsyncDomainName = await this.getAppSyncDomainName();
    const hostedZoneId = await this.getHostedZoneId();

    this.utils.log.warning(
      `Alias record for '${domain.name}' will be deleted from Hosted Zone '${hostedZoneId}'`,
    );
    if (!this.options.yes && !(await confirmAction())) {
      return;
    }

    const progressInstance = this.utils.progress.create({
      message: 'Deleting route53 record',
    });

    const changeId = await this.changeRoute53Record(
      'DELETE',
      hostedZoneId,
      appsyncDomainName,
    );
    if (changeId) {
      await this.checkRoute53RecordStatus(changeId);
      progressInstance.remove();
      this.utils.log.info(
        `Alias record for '${domain.name}' was deleted from Hosted Zone '${hostedZoneId}'`,
      );
      this.utils.log.success('Route53 record deleted successfuly');
    }
  }

  async checkRoute53RecordStatus(changeId: string) {
    let result: Record<string, any>;
    do {
      result = await this.clientFactory
        .getRoute53Client()
        .send(new GetChangeCommand({ Id: changeId }));
      if (result.ChangeInfo.Status !== 'INSYNC') {
        await wait(1000);
      }
    } while (result.ChangeInfo.Status !== 'INSYNC');
  }

  async changeRoute53Record(
    action: 'CREATE' | 'DELETE',
    hostedZoneId: string,
    domainNamConfig: {
      hostedZoneId: string;
      dnsName: string;
    },
  ) {
    const domain = this.getDomain();

    try {
      const { ChangeInfo } = await this.clientFactory.getRoute53Client().send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: hostedZoneId,
          ChangeBatch: {
            Changes: [
              {
                Action: action,
                ResourceRecordSet: {
                  Name: domain.name,
                  Type: 'A',
                  AliasTarget: {
                    HostedZoneId: domainNamConfig.hostedZoneId,
                    DNSName: domainNamConfig.dnsName,
                    EvaluateTargetHealth: false,
                  },
                },
              },
            ],
          },
        }),
      );

      return ChangeInfo?.Id;
    } catch (error) {
      if (error instanceof Error && this.options.quiet) {
        this.utils.log.error(error.message);
      } else {
        throw error;
      }
    }
  }

  displayEndpoints() {
    const endpoints = this.gatheredData.apis.map(
      ({ type, uri }) => `${type}: ${uri}`,
    );

    if (endpoints.length === 0) {
      return;
    }

    const { name } = this.api?.config?.domain || {};
    if (name) {
      endpoints.push(`graphql: https://${name}/graphql`);
      endpoints.push(`realtime: wss://${name}/graphql/realtime`);
    }

    this.serverless.addServiceOutputSection(
      'appsync endpoints',
      endpoints.sort(),
    );
  }

  displayApiKeys() {
    const { conceal } = this.options;
    const apiKeys = this.gatheredData.apiKeys.map(
      ({ description, value }) => `${value} (${description})`,
    );

    if (apiKeys.length === 0) {
      return;
    }

    if (!conceal) {
      this.serverless.addServiceOutputSection('appsync api keys', apiKeys);
    }
  }

  loadConfig() {
    this.utils.log.info('Loading AppSync config');

    const { appSync } = this.serverless.configurationInput;

    try {
      validateConfig(appSync);
    } catch (error) {
      if (error instanceof AppSyncValidationError) {
        this.handleConfigValidationError(error);
      } else {
        throw error;
      }
    }
    const config = getAppSyncConfig(appSync);
    this.naming = new Naming(appSync.name);
    this.api = new Api(config, this);
  }

  validateSchemas() {
    try {
      this.utils.log.info('Validating AppSync schema');
      if (!this.api) {
        throw new this.serverless.classes.Error(
          'Could not load the API. This should not happen.',
        );
      }
      this.api.compileSchema();
    } catch (error) {
      this.utils.log.info('Error');
      if (error instanceof GraphQLError) {
        this.handleError(error.message);
      }

      throw error;
    }
  }

  buildAndAppendResources() {
    if (!this.api) {
      throw new this.serverless.classes.Error(
        'Could not load the API. This should not happen.',
      );
    }

    const resources = this.api.compile();

    merge(this.serverless.service, {
      functions: this.api.functions,
      resources: { Resources: resources },
    });

    this.serverless.service.setFunctionNames(
      this.serverless.processedInput.options,
    );
  }

  public resolveVariable: VariableSourceResolver = ({ address }) => {
    this.loadConfig();

    if (!this.naming) {
      throw new this.serverless.classes.Error(
        'Could not find the naming service. This should not happen.',
      );
    }

    if (address === 'id') {
      return {
        value: {
          'Fn::GetAtt': [this.naming.getApiLogicalId(), 'ApiId'],
        },
      };
    } else if (address === 'arn') {
      return {
        value: {
          'Fn::GetAtt': [this.naming.getApiLogicalId(), 'Arn'],
        },
      };
    } else if (address === 'url') {
      return {
        value: {
          'Fn::GetAtt': [this.naming.getApiLogicalId(), 'GraphQLUrl'],
        },
      };
    } else if (address.startsWith('apiKey.')) {
      const [, name] = address.split('.');
      return {
        value: {
          'Fn::GetAtt': [this.naming.getApiKeyLogicalId(name), 'ApiKey'],
        },
      };
    } else {
      throw new this.serverless.classes.Error(`Unknown address '${address}'`);
    }
  };

  async evaluateResolver() {
    const {
      type,
      field,
      function: fn,
      template,
      context: contextArg,
    } = this.options;

    // Load context from file or inline JSON
    let contextJson: string;
    if (!contextArg) {
      contextJson = JSON.stringify({});
    } else if (contextArg.trim().startsWith('{')) {
      contextJson = contextArg;
    } else {
      const contextPath = path.resolve(contextArg);
      if (!fs.existsSync(contextPath)) {
        throw new this.serverless.classes.Error(
          `Context file not found: ${contextPath}`,
        );
      }
      contextJson = fs.readFileSync(contextPath, 'utf8');
    }

    // VTL template evaluation
    if (template) {
      const templatePath = path.resolve(template);
      if (!fs.existsSync(templatePath)) {
        throw new this.serverless.classes.Error(
          `Template file not found: ${templatePath}`,
        );
      }
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      const result = await this.clientFactory.getAppSyncClient().send(
        new EvaluateMappingTemplateCommand({
          template: templateContent,
          context: contextJson,
        }),
      );

      if (result.error) {
        this.utils.log.error(`Evaluation error: ${result.error.message}`);
      } else {
        this.utils.writeText(result.evaluationResult || '');
      }
      return;
    }

    // JS resolver evaluation — requires type, field, function
    if (!type || !field) {
      throw new this.serverless.classes.Error(
        'You must specify either --template (VTL) or both --type and --field (JS resolver).',
      );
    }

    if (!this.api) {
      this.loadConfig();
    }
    if (!this.api) {
      throw new this.serverless.classes.Error('Could not load the API.');
    }

    const resolverKey = `${type}.${field}`;
    const resolverConfig = this.api.config.resolvers[resolverKey];
    if (!resolverConfig) {
      throw new this.serverless.classes.Error(
        `Resolver '${resolverKey}' not found in configuration.`,
      );
    }

    if (resolverConfig.kind !== 'UNIT' || !resolverConfig.code) {
      throw new this.serverless.classes.Error(
        `Resolver '${resolverKey}' must be a UNIT resolver with a 'code' property for JS evaluation.`,
      );
    }

    const codePath = path.resolve(resolverConfig.code);
    if (!fs.existsSync(codePath)) {
      throw new this.serverless.classes.Error(
        `Resolver code file not found: ${codePath}`,
      );
    }
    let code: string;
    if (this.api.config.esbuild === false) {
      // esbuild disabled — read the file as-is (plain JS only)
      code = fs.readFileSync(codePath, 'utf8');
    } else {
      // compile TS/JS through esbuild, same as JsResolver.getResolverContent()
      const buildResult = buildSync({
        target: 'esnext',
        sourcemap: 'inline',
        sourcesContent: false,
        treeShaking: true,
        ...this.api.config.esbuild,
        platform: 'node',
        format: 'esm',
        entryPoints: [codePath],
        bundle: true,
        write: false,
        external: ['@aws-appsync/utils'],
      });

      if (buildResult.errors.length > 0) {
        throw new this.serverless.classes.Error(
          `Failed to compile resolver code '${codePath}': ${buildResult.errors[0].text}`,
        );
      }

      if (buildResult.outputFiles.length === 0) {
        throw new this.serverless.classes.Error(
          `Failed to compile resolver code '${codePath}': No output files`,
        );
      }

      code = buildResult.outputFiles[0].text;
    }
    const functionToEval = (fn || 'request') as 'request' | 'response';

    const result = await this.clientFactory.getAppSyncClient().send(
      new EvaluateCodeCommand({
        runtime: { name: RuntimeName.APPSYNC_JS, runtimeVersion: '1.0.0' },
        code,
        context: contextJson,
        function: functionToEval,
      }),
    );

    if (result.logs && result.logs.length > 0) {
      this.utils.log.info('Evaluation logs:');
      result.logs.forEach((log) => this.utils.writeText(`  ${log}`));
    }

    if (result.error) {
      this.utils.log.error(`Evaluation error: ${result.error.message}`);
      if (result.error.codeErrors && result.error.codeErrors.length > 0) {
        result.error.codeErrors.forEach((ce) => {
          this.utils.log.error(
            `  ${ce.value} (line ${ce.location?.line}, col ${ce.location?.column})`,
          );
        });
      }
    } else {
      this.utils.writeText(result.evaluationResult || '');
    }
  }

  async envGet() {
    const apiId = await this.getApiId();

    const { environmentVariables } = await this.clientFactory
      .getAppSyncClient()
      .send(new GetGraphqlApiEnvironmentVariablesCommand({ apiId }));

    if (
      !environmentVariables ||
      Object.keys(environmentVariables).length === 0
    ) {
      this.utils.log.info('No environment variables set for this API.');
      return;
    }

    const lines = Object.entries(environmentVariables).map(
      ([key, value]) => `${key}=${value}`,
    );
    this.utils.writeText(lines.join('\n'));
  }

  async envSet() {
    const { key, value } = this.options;

    if (!key || !value) {
      throw new this.serverless.classes.Error(
        'You must specify both --key and --value.',
      );
    }

    const apiId = await this.getApiId();

    // Fetch existing variables first so we do a merge, not a full replace
    const { environmentVariables: existing } = await this.clientFactory
      .getAppSyncClient()
      .send(new GetGraphqlApiEnvironmentVariablesCommand({ apiId }));

    const updated = { ...(existing || {}), [key]: value };

    await this.clientFactory.getAppSyncClient().send(
      new PutGraphqlApiEnvironmentVariablesCommand({
        apiId,
        environmentVariables: updated,
      }),
    );

    this.utils.log.success(`Environment variable '${key}' set successfully.`);
  }

  handleConfigValidationError(error: AppSyncValidationError) {
    const errors = error.validationErrors.map(
      (error) => `     at appSync${error.path}: ${error.message}`,
    );
    const message = `Invalid AppSync Configuration:\n${errors.join('\n')}`;
    this.handleError(message);
  }

  handleError(message: string) {
    const { configValidationMode } = this.serverless.service;
    if (configValidationMode === 'error') {
      throw new this.serverless.classes.Error(message);
    } else if (configValidationMode === 'warn') {
      this.utils.log.warning(message);
    }
  }
}

export = ServerlessAppsyncPlugin;

import { writeText, log, progress } from '@serverless/utils/log';
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
  DescribeStackResourcesInput,
  DescribeStackResourcesOutput,
} from 'aws-sdk/clients/cloudformation';
import {
  AssociateApiRequest,
  AssociateApiResponse,
  CreateDomainNameRequest,
  DeleteDomainNameRequest,
  DeleteDomainNameResponse,
  DisassociateApiRequest,
  DisassociateApiResponse,
  GetApiAssociationRequest,
  GetApiAssociationResponse,
  GetDomainNameRequest,
  GetDomainNameResponse,
  GetGraphqlApiRequest,
  GetGraphqlApiResponse,
  GetIntrospectionSchemaRequest,
  GetIntrospectionSchemaResponse,
  ListApiKeysRequest,
  ListApiKeysResponse,
} from 'aws-sdk/clients/appsync';
import {
  CommandsDefinition,
  Hook,
  VariablesSourcesDefinition,
  VariableSourceResolver,
} from 'serverless';
import {
  FilterLogEventsResponse,
  FilterLogEventsRequest,
} from 'aws-sdk/clients/cloudwatchlogs';
import { AppSyncValidationError, validateConfig } from './validation';
import {
  confirmAction,
  getHostedZoneName,
  parseDateTimeOrDuration,
  wait,
} from './utils';
import { Api } from './resources/Api';
import { Naming } from './resources/Naming';
import {
  ChangeResourceRecordSetsRequest,
  ChangeResourceRecordSetsResponse,
  GetChangeRequest,
  GetChangeResponse,
  ListHostedZonesByNameRequest,
  ListHostedZonesByNameResponse,
} from 'aws-sdk/clients/route53';

const CONSOLE_BASE_URL = 'https://console.aws.amazon.com';

class ServerlessAppsyncPlugin {
  private provider: Provider;
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

  constructor(
    public serverless: Serverless,
    private options: Record<string, string>,
  ) {
    this.gatheredData = {
      apis: [],
      apiKeys: [],
    };
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');

    // We are using a newer version of AJV than Serverless Frameowrk
    // and some customizations (eg: custom errors, $merge, filter irrelevant errors )
    // For SF, just validate the type of input to allow us to use a custom
    // field (ie: `appSync`). Actual valiation will be handled by this plugin
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
                usage: 'Create the CNAME record for this domain in Route53',
                lifecycleEvents: ['run'],
                options: {
                  quiet: {
                    usage: "Don't return an error if the record already exists",
                    shortcut: 'q',
                    required: false,
                    type: 'boolean',
                  },
                },
              },
              'delete-record': {
                usage: 'Deletes the CNAME record for this domain from Route53',
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
        log.success('AppSync schema valid');
      },
      'appsync:get-introspection:run': () => this.getIntrospection(),
      'appsync:flush-cache:run': () => this.flushCache(),
      'appsync:console:run': () => this.openConsole(),
      'appsync:cloudwatch:run': () => this.openCloudWatch(),
      'appsync:logs:run': async () => this.initShowLogs(),
      'before:appsync:domain:create:run': async () => this.loadConfig(),
      'appsync:domain:create:run': async () => this.createDomain(),
      'before:appsync:domain:delete:run': async () => this.loadConfig(),
      'appsync:domain:delete:run': async () => this.deleteDomain(),
      'before:appsync:domain:assoc:run': async () => this.loadConfig(),
      'appsync:domain:assoc:run': async () => this.assocDomain(),
      'before:appsync:domain:disassoc:run': async () => this.loadConfig(),
      'appsync:domain:disassoc:run': async () => this.disassocDomain(),
      'before:appsync:domain:create-record:run': async () => this.loadConfig(),
      'appsync:domain:create-record:run': async () => this.createRecord(),
      'before:appsync:domain:delete-record:run': async () => this.loadConfig(),
      'appsync:domain:delete-record:run': async () => this.deleteRecord(),
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
    const { StackResources } = await this.provider.request<
      DescribeStackResourcesInput,
      DescribeStackResourcesOutput
    >('CloudFormation', 'describeStackResources', {
      StackName: this.provider.naming.getStackName(),
    });

    const apiId = last(
      StackResources?.find(
        (resource) => resource.ResourceType === 'AWS::AppSync::GraphQLApi',
      )?.PhysicalResourceId?.split('/'),
    );

    if (!apiId) {
      throw new this.serverless.classes.Error(
        'AppSync Api not found in stack. Did you forget to deploy?',
      );
    }

    return apiId;
  }

  async gatherData() {
    const apiId = await this.getApiId();

    const { graphqlApi } = await this.provider.request<
      GetGraphqlApiRequest,
      GetGraphqlApiResponse
    >('AppSync', 'getGraphqlApi', {
      apiId,
    });

    forEach(graphqlApi?.uris, (value, type) => {
      this.gatheredData.apis.push({
        id: apiId,
        type: type.toLowerCase(),
        uri: value,
      });
    });

    const { apiKeys } = await this.provider.request<
      ListApiKeysRequest,
      ListApiKeysResponse
    >('AppSync', 'listApiKeys', {
      apiId: apiId,
    });

    apiKeys?.forEach((apiKey) => {
      this.gatheredData.apiKeys.push({
        value: apiKey.id || 'unknown key',
        description: apiKey.description,
      });
    });
  }

  async getIntrospection() {
    const apiId = await this.getApiId();

    const { schema } = await this.provider.request<
      GetIntrospectionSchemaRequest,
      GetIntrospectionSchemaResponse
    >('AppSync', 'getIntrospectionSchema', {
      apiId,
      format: (this.options.format || 'JSON').toUpperCase(),
    });

    if (!schema) {
      throw new this.serverless.classes.Error('Schema not found');
    }

    if (this.options.output) {
      try {
        const filePath = path.resolve(this.options.output);
        fs.writeFileSync(filePath, schema.toString());
        log.success(`Introspection schema exported to ${filePath}`);
      } catch (error) {
        log.error(`Could not save to file: ${(error as Error).message}`);
      }
      return;
    }

    writeText(schema.toString());
  }

  async flushCache() {
    const apiId = await this.getApiId();
    await this.provider.request('AppSync', 'flushApiCache', { apiId });
    log.success('Cache flushed successfully');
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

    const { events, nextToken: newNextToken } = await this.provider.request<
      FilterLogEventsRequest,
      FilterLogEventsResponse
    >('CloudWatchLogs', 'filterLogEvents', {
      logGroupName,
      startTime: startTime.toMillis(),
      nextToken,
      filterPattern: this.options.filter,
    });

    events?.forEach((event) => {
      const { timestamp, message } = event;
      writeText(
        `${chalk.gray(
          DateTime.fromMillis(timestamp || 0).toISO(),
        )}\t${message}`,
      );
    });

    const lastTs = last(events)?.timestamp;
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

  async createDomain() {
    try {
      const domain = this.getDomain();
      await this.provider.request<
        CreateDomainNameRequest,
        CreateDomainNameRequest
      >('AppSync', 'createDomainName', {
        domainName: domain.name,
        certificateArn: domain.certificateArn,
      });
      log.success(`Domain '${domain.name}' created successfully`);
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        this.options.quiet
      ) {
        log.error(error.message);
      } else {
        throw error;
      }
    }
  }

  async deleteDomain() {
    try {
      const domain = this.getDomain();
      log.warning(`The domain '${domain.name} will be deleted.`);
      if (!this.options.yes && !(await confirmAction())) {
        return;
      }
      await this.provider.request<
        DeleteDomainNameRequest,
        DeleteDomainNameResponse
      >('AppSync', 'deleteDomainName', {
        domainName: domain.name,
      });
      log.success(`Domain '${domain.name}' deleted successfully`);
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        this.options.quiet
      ) {
        log.error(error.message);
      } else {
        throw error;
      }
    }
  }

  async getApiAssocStatus(name: string) {
    try {
      const result = await this.provider.request<
        GetApiAssociationRequest,
        GetApiAssociationResponse
      >('AppSync', 'getApiAssociation', {
        domainName: name,
      });
      return result.apiAssociation;
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        error.providerErrorCodeExtension === 'NOT_FOUND_EXCEPTION'
      ) {
        return { associationStatus: 'NOT_FOUND' };
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
    const progressInstance = progress.create({ message });

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
      log.warning(
        `The domain ${domain.name} is currently associated to another API (${assoc?.apiId})`,
      );
      if (!this.options.yes && !(await confirmAction())) {
        return;
      }
    } else if (assoc?.apiId === apiId) {
      log.success('The domain is already associated to this API');
      return;
    }

    await this.provider.request<AssociateApiRequest, AssociateApiResponse>(
      'AppSync',
      'associateApi',
      {
        domainName: domain.name,
        apiId,
      },
    );

    const message = `Associating API with domain '${domain.name}'`;
    await this.showApiAssocStatus({
      name: domain.name,
      message,
      desiredStatus: 'SUCCESS',
    });
    log.success(`API successfully associated to domain '${domain.name}'`);
  }

  async disassocDomain() {
    const domain = this.getDomain();
    const apiId = await this.getApiId();
    const assoc = await this.getApiAssocStatus(domain.name);

    if (assoc?.associationStatus === 'NOT_FOUND') {
      log.warning(
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
    log.warning(
      `The domain ${domain.name} will be disassociated from API '${apiId}'`,
    );

    if (!this.options.yes && !(await confirmAction())) {
      return;
    }

    await this.provider.request<
      DisassociateApiRequest,
      DisassociateApiResponse
    >('AppSync', 'disassociateApi', {
      domainName: domain.name,
    });

    const message = `Disassociating API from domain '${domain.name}'`;
    await this.showApiAssocStatus({
      name: domain.name,
      message,
      desiredStatus: 'NOT_FOUND',
    });

    log.success(`API successfully disassociated from domain '${domain.name}'`);
  }

  async getHostedZoneId() {
    const domain = this.getDomain();
    if (typeof domain.route53 === 'object' && domain.route53.hostedZoneId) {
      return domain.route53.hostedZoneId;
    } else {
      const { HostedZones } = await this.provider.request<
        ListHostedZonesByNameRequest,
        ListHostedZonesByNameResponse
      >('Route53', 'listHostedZonesByName', {});
      const hostedZoneName =
        typeof domain.route53 === 'object' && domain.route53.hostedZoneName
          ? domain.route53.hostedZoneName
          : getHostedZoneName(domain.name);
      const foundHostedZone = HostedZones.find(
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
    const { domainNameConfig } = await this.provider.request<
      GetDomainNameRequest,
      GetDomainNameResponse
    >('AppSync', 'getDomainName', {
      domainName: domain.name,
    });
    const { appsyncDomainName } = domainNameConfig || {};
    if (!appsyncDomainName) {
      throw new this.serverless.classes.Error(
        `Domain ${domain.name} not found\nDid you forget to run 'sls appsync domain create'?`,
      );
    }

    return appsyncDomainName;
  }

  async createRecord() {
    const progressInstance = progress.create({
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
      log.info(
        `CNAME record '${domain.name}' with value '${appsyncDomainName}' was created in Hosted Zone '${hostedZoneId}'`,
      );
      log.success('Route53 record created successfuly');
    }
  }

  async deleteRecord() {
    const domain = this.getDomain();
    const appsyncDomainName = await this.getAppSyncDomainName();
    const hostedZoneId = await this.getHostedZoneId();

    log.warning(
      `CNAME record '${domain.name}' with value '${appsyncDomainName}' will be deleted from Hosted Zone '${hostedZoneId}'`,
    );
    if (!this.options.yes && !(await confirmAction())) {
      return;
    }

    const progressInstance = progress.create({
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
      log.info(
        `CNAME record '${domain.name}' with value '${appsyncDomainName}' was deleted from Hosted Zone '${hostedZoneId}'`,
      );
      log.success('Route53 record deleted successfuly');
    }
  }

  async checkRoute53RecordStatus(changeId: string) {
    let result: GetChangeResponse;
    do {
      result = await this.provider.request<GetChangeRequest, GetChangeResponse>(
        'Route53',
        'getChange',
        { Id: changeId },
      );
      if (result.ChangeInfo.Status !== 'INSYNC') {
        await wait(1000);
      }
    } while (result.ChangeInfo.Status !== 'INSYNC');
  }

  async changeRoute53Record(
    action: 'CREATE' | 'DELETE',
    hostedZoneId: string,
    cname: string,
  ) {
    const domain = this.getDomain();

    try {
      const { ChangeInfo } = await this.provider.request<
        ChangeResourceRecordSetsRequest,
        ChangeResourceRecordSetsResponse
      >('Route53', 'changeResourceRecordSets', {
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: action,
              ResourceRecordSet: {
                Name: domain.name,
                Type: 'CNAME',
                ResourceRecords: [{ Value: cname }],
                TTL: 300,
              },
            },
          ],
        },
      });

      return ChangeInfo.Id;
    } catch (error) {
      if (
        error instanceof this.serverless.classes.Error &&
        this.options.quiet
      ) {
        log.error(error.message);
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

    this.serverless.addServiceOutputSection('appsync endpoints', endpoints);
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
    log.info('Loading AppSync config');

    const { appSync } = this.serverless.configurationInput;

    try {
      validateConfig(appSync);
      const config = getAppSyncConfig(appSync);
      this.api = new Api(config, this);
    } catch (error) {
      if (error instanceof AppSyncValidationError) {
        this.handleConfigValidationError(error);
      } else {
        throw error;
      }
    }
  }

  validateSchemas() {
    try {
      log.info('Validating AppSync schema');
      if (!this.api) {
        throw new this.serverless.classes.Error(
          'Could not load the API. This should not happen.',
        );
      }
      this.api.compileSchema();
    } catch (error) {
      log.info('Error');
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
    merge(this.serverless.service, { resources: { Resources: resources } });
    merge(this.serverless.configurationInput, {
      functions: this.api.functions,
    });

    this.serverless.service.setFunctionNames(
      this.serverless.processedInput.options,
    );
  }

  public resolveVariable: VariableSourceResolver = ({ address }) => {
    const naming = new Naming(this.serverless.configurationInput.appSync.name);

    if (address === 'id') {
      return {
        value: {
          'Fn::GetAtt': [naming.getApiLogicalId(), 'ApiId'],
        },
      };
    } else if (address === 'arn') {
      return {
        value: {
          'Fn::GetAtt': [naming.getApiLogicalId(), 'Arn'],
        },
      };
    } else if (address === 'url') {
      return {
        value: {
          'Fn::GetAtt': [naming.getApiLogicalId(), 'GraphQLUrl'],
        },
      };
    } else if (address.startsWith('apiKey.')) {
      const [, name] = address.split('.');
      return {
        value: {
          'Fn::GetAtt': [naming.getApiKeyLogicalId(name), 'ApiKey'],
        },
      };
    } else {
      throw new this.serverless.classes.Error(`Unknown address '${address}'`);
    }
  };

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
      log.warning(message);
    }
  }
}

export = ServerlessAppsyncPlugin;

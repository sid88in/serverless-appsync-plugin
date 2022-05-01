import { isEmpty, reduce } from 'lodash';
import {
  CfnResources,
  CfnWafAction,
  CfnWafRule,
  CfnWafRuleStatement,
} from '../types/cloudFormation';
import {
  ApiKeyConfig,
  WafConfig,
  WafRule,
  WafRuleAction,
  WafRuleDisableIntrospection,
  WafThrottleConfig,
} from '../types/plugin';
import { Api } from './Api';

export class Waf {
  constructor(private api: Api, private config: WafConfig) {}

  compile(): CfnResources {
    const wafConfig = this.config;
    if (wafConfig.enabled === false) {
      return {};
    }

    const name = wafConfig.name || `${this.api.config.name}Waf`;
    const apiLogicalId = this.api.naming.getApiLogicalId();
    const wafLogicalId = this.api.naming.getWafLogicalId();
    const wafAssocLogicalId = this.api.naming.getWafAssociationLogicalId();
    const defaultActionSource = wafConfig.defaultAction || 'Allow';
    const defaultAction: CfnWafAction =
      typeof defaultActionSource === 'string'
        ? { [defaultActionSource]: {} }
        : defaultActionSource;

    return {
      [wafLogicalId]: {
        Type: 'AWS::WAFv2::WebACL',
        Properties: {
          DefaultAction: defaultAction,
          Scope: 'REGIONAL',
          Description:
            wafConfig.description ||
            `ACL rules for AppSync ${this.api.config.name}`,
          Name: name,
          Rules: this.buildWafRules(),
          VisibilityConfig: this.getWafVisibilityConfig(
            this.config.visibilityConfig,
            name,
          ),
          Tags: this.api.getTagsConfig(),
        },
      },
      [wafAssocLogicalId]: {
        Type: 'AWS::WAFv2::WebACLAssociation',
        Properties: {
          ResourceArn: { 'Fn::GetAtt': [apiLogicalId, 'Arn'] },
          WebACLArn: { 'Fn::GetAtt': [wafLogicalId, 'Arn'] },
        },
      },
    };
  }

  buildWafRules() {
    const rules = this.config.rules || [];

    let defaultPriority = 100;
    return rules
      .map((rule) => this.buildWafRule(rule))
      .concat(this.buildApiKeysWafRules())
      .map((rule) => ({
        ...rule,
        Priority: rule.Priority || defaultPriority++,
      }));
  }

  buildWafRule(rule: WafRule, defaultNamePrefix?: string): CfnWafRule {
    // Throttle pre-set rule
    if (rule === 'throttle') {
      return this.buildThrottleRule({}, defaultNamePrefix);
    } else if (typeof rule === 'object' && 'throttle' in rule) {
      return this.buildThrottleRule(rule.throttle, defaultNamePrefix);
    }

    // Disable Introspection pre-set rule
    if (rule === 'disableIntrospection') {
      return this.buildDisableIntrospectionRule({}, defaultNamePrefix);
    } else if ('disableIntrospection' in rule) {
      return this.buildDisableIntrospectionRule(
        rule.disableIntrospection,
        defaultNamePrefix,
      );
    }

    const action: WafRuleAction = rule.action || 'Allow';

    const result: CfnWafRule = {
      Name: rule.name,
      Action: { [action]: {} },
      Priority: rule.priority,
      Statement: rule.statement,
      VisibilityConfig: this.getWafVisibilityConfig(
        rule.visibilityConfig,
        rule.name,
      ),
    };

    return result;
  }

  buildApiKeysWafRules(): CfnWafRule[] {
    return (
      reduce(
        this.api.config.apiKeys,
        (rules, key) => rules.concat(this.buildApiKeyRules(key)),
        [] as CfnWafRule[],
      ) || []
    );
  }

  buildApiKeyRules(key: ApiKeyConfig) {
    const rules = key.wafRules;
    // Build the rule and add a matching rule for the X-Api-Key header
    // for the given api key
    const allRules: CfnWafRule[] = [];
    rules?.forEach((keyRule) => {
      const builtRule = this.buildWafRule(keyRule, key.name);
      const logicalIdApiKey = this.api.naming.getApiKeyLogicalId(key.name);
      const { Statement: baseStatement } = builtRule;
      const apiKeyStatement: CfnWafRuleStatement = {
        ByteMatchStatement: {
          FieldToMatch: {
            SingleHeader: { Name: 'X-Api-key' },
          },
          PositionalConstraint: 'EXACTLY',
          SearchString: { 'Fn::GetAtt': [logicalIdApiKey, 'ApiKey'] },
          TextTransformations: [
            {
              Type: 'LOWERCASE',
              Priority: 0,
            },
          ],
        },
      };

      let statement: CfnWafRuleStatement;
      if (baseStatement && baseStatement?.RateBasedStatement) {
        let ScopeDownStatement: CfnWafRuleStatement;
        // For RateBasedStatement, use the api rule as ScopeDownStatement
        // merge if with existing needed
        if (baseStatement.RateBasedStatement?.ScopeDownStatement) {
          ScopeDownStatement = this.mergeWafRuleStatements([
            baseStatement.RateBasedStatement.ScopeDownStatement,
            apiKeyStatement,
          ]);
        } else {
          ScopeDownStatement = apiKeyStatement;
        }
        // RateBasedStatement
        statement = {
          RateBasedStatement: {
            ...baseStatement.RateBasedStatement,
            ScopeDownStatement,
          },
        };
      } else if (!isEmpty(baseStatement)) {
        // Other rules: combine them (And Statement)
        statement = this.mergeWafRuleStatements([
          baseStatement,
          apiKeyStatement,
        ]);
      } else {
        // No statement, the rule is the API key rule itself
        statement = apiKeyStatement;
      }

      allRules.push({
        ...builtRule,
        Statement: statement,
      });
    });

    return allRules;
  }

  mergeWafRuleStatements(
    statements: CfnWafRuleStatement[],
  ): CfnWafRuleStatement {
    return {
      AndStatement: {
        Statements: statements,
      },
    };
  }

  getWafVisibilityConfig(
    visibilityConfig: Record<string, unknown> | undefined = {},
    defaultName: string,
  ) {
    return {
      CloudWatchMetricsEnabled:
        visibilityConfig.cloudWatchMetricsEnabled ??
        this.config.visibilityConfig?.cloudWatchMetricsEnabled ??
        true,
      MetricName: visibilityConfig.name || defaultName,
      SampledRequestsEnabled:
        visibilityConfig.sampledRequestsEnabled ??
        this.config.visibilityConfig?.sampledRequestsEnabled ??
        true,
    };
  }

  buildDisableIntrospectionRule(
    config: WafRuleDisableIntrospection['disableIntrospection'],
    defaultNamePrefix?: string,
  ): CfnWafRule {
    const Name =
      config.name || `${defaultNamePrefix || ''}DisableIntrospection`;

    return {
      Action: {
        Block: {},
      },
      Name,
      Priority: config.priority,
      Statement: {
        OrStatement: {
          Statements: [
            {
              // Block all requests > 8kb
              // https://docs.aws.amazon.com/waf/latest/developerguide/web-request-body-inspection.html
              SizeConstraintStatement: {
                ComparisonOperator: 'GT',
                FieldToMatch: {
                  Body: {},
                },
                Size: 8 * 1024,
                TextTransformations: [
                  {
                    Type: 'NONE',
                    Priority: 0,
                  },
                ],
              },
            },
            {
              ByteMatchStatement: {
                FieldToMatch: {
                  Body: {},
                },
                PositionalConstraint: 'CONTAINS',
                SearchString: '__schema',
                TextTransformations: [
                  {
                    Type: 'COMPRESS_WHITE_SPACE',
                    Priority: 0,
                  },
                ],
              },
            },
          ],
        },
      },
      VisibilityConfig: this.getWafVisibilityConfig(
        typeof config === 'object' ? config.visibilityConfig : undefined,
        Name,
      ),
    };
  }

  buildThrottleRule(
    config: WafThrottleConfig,
    defaultNamePrefix?: string,
  ): CfnWafRule {
    let Name = `${defaultNamePrefix || ''}Throttle`;
    let Limit = 100;
    let AggregateKeyType = 'IP';
    let ForwardedIPConfig;
    let Priority;
    let ScopeDownStatement;

    if (typeof config === 'number') {
      Limit = config;
    } else if (typeof config === 'object') {
      Name = config.name || Name;
      AggregateKeyType = config.aggregateKeyType || AggregateKeyType;
      Limit = config.limit || Limit;
      Priority = config.priority;
      ScopeDownStatement = config.scopeDownStatement;
      if (AggregateKeyType === 'FORWARDED_IP') {
        ForwardedIPConfig = {
          HeaderName: config.forwardedIPConfig?.headerName || 'X-Forwarded-For',
          FallbackBehavior:
            config.forwardedIPConfig?.fallbackBehavior || 'MATCH',
        };
      }
    }

    return {
      Action: {
        Block: {},
      },
      Name,
      Priority,
      Statement: {
        RateBasedStatement: {
          AggregateKeyType,
          Limit,
          ForwardedIPConfig,
          ScopeDownStatement,
        },
      },
      VisibilityConfig: this.getWafVisibilityConfig(
        typeof config === 'object' ? config.visibilityConfig : undefined,
        Name,
      ),
    };
  }
}

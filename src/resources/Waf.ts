import { isEmpty } from 'lodash';
import { has } from 'ramda';
import {
  CfnResources,
  CfnWafAction,
  CfnWafRule,
  CfnWafRuleStatement,
} from '../types/cloudFormation';
import {
  ApiKeyConfigObject,
  WafAction,
  WafConfig,
  WafRule,
  WafRuleDisableIntrospection,
  WafThrottleConfig,
} from '../types/plugin';
import { toCfnKeys } from '../utils';
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
      .map((rule) => this.buildWafRule(rule, 'Base'))
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
    } else if (has('throttle')(rule)) {
      return this.buildThrottleRule(rule.throttle, defaultNamePrefix);
    }

    // Disable Introspection pre-set rule
    if (rule === 'disableIntrospection') {
      return this.buildDisableIntrospecRule({}, defaultNamePrefix);
    } else if (has('disableIntrospection')(rule)) {
      return this.buildDisableIntrospecRule(
        rule.disableIntrospection,
        defaultNamePrefix,
      );
    }

    // Other specific rules
    let action: WafAction = rule.action || 'Allow'; // fixme, if group, should not be set
    if (typeof action === 'string') {
      action = { [action]: {} };
    }

    let { overrideAction } = rule;
    if (typeof overrideAction === 'string') {
      overrideAction = { [overrideAction]: {} };
    }

    const result: CfnWafRule = {
      Name: rule.name,
      Priority: rule.priority,
      Statement: rule.statement,
      VisibilityConfig: this.getWafVisibilityConfig(
        rule.visibilityConfig,
        rule.name,
      ),
    };
    // only one of Action or OverrideAction is allowed
    if (overrideAction) {
      result.OverrideAction = toCfnKeys(overrideAction);
    } else if (action) {
      result.Action = action;
    }
    return result;
  }

  buildApiKeysWafRules(): CfnWafRule[] {
    return this.api
      .getApiKeys()
      .reduce(
        (rules, key) => rules.concat(this.buildApiKeyRules(key)),
        [] as CfnWafRule[],
      );
  }

  buildApiKeyRules(key: ApiKeyConfigObject) {
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
        visibilityConfig.cloudWatchMetricsEnabled || true,
      MetricName: visibilityConfig.name || defaultName,
      SampledRequestsEnabled: visibilityConfig.sampledRequestsEnabled || true,
    };
  }

  buildDisableIntrospecRule(
    config: WafRuleDisableIntrospection['disableIntrospection'],
    defaultNamePrefix?: string,
  ): CfnWafRule {
    const Name = config.name || `${defaultNamePrefix}DisableIntrospection`;

    return {
      Action: {
        Block: {},
      },
      Name,
      Priority: config.priority,
      Statement: {
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
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        MetricName: Name,
        CloudWatchMetricsEnabled: true,
      },
    };
  }

  buildThrottleRule(
    config: WafThrottleConfig,
    defaultNamePrefix?: string,
  ): CfnWafRule {
    let Name = `${defaultNamePrefix}Throttle`;
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
      VisibilityConfig: {
        CloudWatchMetricsEnabled: true,
        MetricName: Name,
        SampledRequestsEnabled: true,
      },
    };
  }
}

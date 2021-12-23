import { Api } from '../resources/Api';
import { ApiKeyConfig, WafRule } from '../types/plugin';
import { each } from 'lodash';
import { Waf } from '../resources/Waf';
import * as given from './given';

const plugin = given.plugin();

describe('Waf', () => {
  describe('Base Resources', () => {
    it('should generate waf Resources', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const waf = new Waf(api, {
        enabled: true,
        name: 'Waf',
        defaultAction: 'Allow',
        description: 'My Waf ACL',
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          name: 'MyVisibilityConfig',
          sampledRequestsEnabled: true,
        },
        rules: [],
      });
      expect(waf.compile()).toMatchInlineSnapshot(`
        Object {
          "GraphQlWaf": Object {
            "Properties": Object {
              "DefaultAction": Object {
                "Allow": Object {},
              },
              "Description": "My Waf ACL",
              "Name": "Waf",
              "Rules": Array [],
              "Scope": "REGIONAL",
              "Tags": Array [
                Object {
                  "Key": "stage",
                  "Value": "Dev",
                },
              ],
              "VisibilityConfig": Object {
                "CloudWatchMetricsEnabled": true,
                "MetricName": "MyVisibilityConfig",
                "SampledRequestsEnabled": true,
              },
            },
            "Type": "AWS::WAFv2::WebACL",
          },
          "GraphQlWafAssoc": Object {
            "Properties": Object {
              "ResourceArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlApi",
                  "Arn",
                ],
              },
              "WebACLArn": Object {
                "Fn::GetAtt": Array [
                  "GraphQlWaf",
                  "Arn",
                ],
              },
            },
            "Type": "AWS::WAFv2::WebACLAssociation",
          },
        }
      `);
    });
  });

  it('should not generate waf Resources if disabled', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      enabled: false,
      name: 'Waf',
      defaultAction: 'Allow',
      description: 'My Waf ACL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        name: 'MyVisibilityConfig',
        sampledRequestsEnabled: true,
      },
      rules: [],
    });
    expect(waf.compile()).toEqual({});
  });

  describe('Throttle rules', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      enabled: false,
      name: 'Waf',
      defaultAction: 'Allow',
      description: 'My Waf ACL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        name: 'MyVisibilityConfig',
        sampledRequestsEnabled: true,
      },
      rules: [],
    });

    it('should generate a preset rule', () => {
      expect(waf.buildWafRule('throttle', 'Base')).toMatchInlineSnapshot(`
        Object {
          "Action": Object {
            "Block": Object {},
          },
          "Name": "BaseThrottle",
          "Priority": undefined,
          "Statement": Object {
            "RateBasedStatement": Object {
              "AggregateKeyType": "IP",
              "ForwardedIPConfig": undefined,
              "Limit": 100,
              "ScopeDownStatement": undefined,
            },
          },
          "VisibilityConfig": Object {
            "CloudWatchMetricsEnabled": true,
            "MetricName": "BaseThrottle",
            "SampledRequestsEnabled": true,
          },
        }
      `);
    });

    it('should generate a preset rule with limit', () => {
      expect(waf.buildWafRule({ throttle: 500 }, 'Base'))
        .toMatchInlineSnapshot(`
        Object {
          "Action": Object {
            "Block": Object {},
          },
          "Name": "BaseThrottle",
          "Priority": undefined,
          "Statement": Object {
            "RateBasedStatement": Object {
              "AggregateKeyType": "IP",
              "ForwardedIPConfig": undefined,
              "Limit": 500,
              "ScopeDownStatement": undefined,
            },
          },
          "VisibilityConfig": Object {
            "CloudWatchMetricsEnabled": true,
            "MetricName": "BaseThrottle",
            "SampledRequestsEnabled": true,
          },
        }
      `);
    });

    it('should generate a preset rule with config', () => {
      expect(
        waf.buildWafRule(
          {
            throttle: {
              priority: 300,
              limit: 200,
              aggregateKeyType: 'FORWARDED_IP',
              forwardedIPConfig: {
                headerName: 'X-Forwarded-To',
                fallbackBehavior: 'FOO',
              },
            },
          },

          'Base',
        ),
      ).toMatchInlineSnapshot(`
        Object {
          "Action": Object {
            "Block": Object {},
          },
          "Name": "BaseThrottle",
          "Priority": 300,
          "Statement": Object {
            "RateBasedStatement": Object {
              "AggregateKeyType": "FORWARDED_IP",
              "ForwardedIPConfig": Object {
                "FallbackBehavior": "FOO",
                "HeaderName": "X-Forwarded-To",
              },
              "Limit": 200,
              "ScopeDownStatement": undefined,
            },
          },
          "VisibilityConfig": Object {
            "CloudWatchMetricsEnabled": true,
            "MetricName": "BaseThrottle",
            "SampledRequestsEnabled": true,
          },
        }
      `);
    });
  });

  describe('Disable introspection', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      enabled: false,
      name: 'Waf',
      defaultAction: 'Allow',
      description: 'My Waf ACL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        name: 'MyVisibilityConfig',
        sampledRequestsEnabled: true,
      },
      rules: [],
    });

    it('should generate a preset rule', () => {
      expect(waf.buildWafRule('disableIntrospection', 'Base'))
        .toMatchInlineSnapshot(`
        Object {
          "Action": Object {
            "Block": Object {},
          },
          "Name": "BaseDisableIntrospection",
          "Priority": undefined,
          "Statement": Object {
            "ByteMatchStatement": Object {
              "FieldToMatch": Object {
                "Body": Object {},
              },
              "PositionalConstraint": "CONTAINS",
              "SearchString": "__schema",
              "TextTransformations": Array [
                Object {
                  "Priority": 0,
                  "Type": "COMPRESS_WHITE_SPACE",
                },
              ],
            },
          },
          "VisibilityConfig": Object {
            "CloudWatchMetricsEnabled": true,
            "MetricName": "BaseDisableIntrospection",
            "SampledRequestsEnabled": true,
          },
        }
      `);
    });

    it('should generate a preset rule with custon config', () => {
      expect(
        waf.buildWafRule({ disableIntrospection: { priority: 200 } }, 'Base'),
      ).toMatchInlineSnapshot(`
        Object {
          "Action": Object {
            "Block": Object {},
          },
          "Name": "BaseDisableIntrospection",
          "Priority": 200,
          "Statement": Object {
            "ByteMatchStatement": Object {
              "FieldToMatch": Object {
                "Body": Object {},
              },
              "PositionalConstraint": "CONTAINS",
              "SearchString": "__schema",
              "TextTransformations": Array [
                Object {
                  "Priority": 0,
                  "Type": "COMPRESS_WHITE_SPACE",
                },
              ],
            },
          },
          "VisibilityConfig": Object {
            "CloudWatchMetricsEnabled": true,
            "MetricName": "BaseDisableIntrospection",
            "SampledRequestsEnabled": true,
          },
        }
      `);
    });
  });

  describe('ApiKey rules', () => {
    const configs: Record<string, WafRule> = {
      throttle: 'throttle',
      disableIntrospection: 'disableIntrospection',
      customRule: {
        name: 'MyCustomRule',
        statement: {
          GeoMatchStatement: {
            CountryCodes: ['US'],
          },
        },
      },
      throttleWithStatements: {
        throttle: {
          name: 'Throttle rule with custom ScopeDownStatement',
          limit: 100,
          scopeDownStatement: {
            ByteMatchStatement: {
              FieldToMatch: {
                SingleHeader: { Name: 'X-Foo' },
              },
              PositionalConstraint: 'EXACTLY',
              SearchString: 'Bar',
              TextTransformations: [
                {
                  Type: 'LOWERCASE',
                  Priority: 0,
                },
              ],
            },
          },
        },
      },
      emptyStatements: {
        name: 'rulesWithoutStatements',
        statement: {},
      },
    };
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      enabled: false,
      name: 'Waf',
      defaultAction: 'Allow',
      description: 'My Waf ACL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        name: 'MyVisibilityConfig',
        sampledRequestsEnabled: true,
      },
      rules: [],
    });

    each(configs, (rule, name) => {
      it(`should generate a rule for ${name}`, () => {
        const apiConfig: ApiKeyConfig = {
          name: 'MyKey',
          wafRules: [rule],
        };
        expect(waf.buildApiKeyRules(apiConfig)).toMatchSnapshot();
      });
    });
  });
});

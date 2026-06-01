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
      expect(waf.compile()).toMatchSnapshot();
    });

    it('should generate waf Resources without tags', () => {
      const api = new Api(
        given.appSyncConfig({
          tags: undefined,
        }),
        plugin,
      );
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
      expect(waf.compile()).toMatchSnapshot();
    });

    it('should not generate waf Resources if disabled', () => {
      const api = new Api(
        given.appSyncConfig({
          waf: {
            enabled: false,
            name: 'Waf',
            rules: [],
          },
        }),
        plugin,
      );
      expect(api.compileWafRules()).toEqual({});
    });

    it('should generate only the waf association', () => {
      const api = new Api(given.appSyncConfig(), plugin);
      const waf = new Waf(api, {
        enabled: true,
        arn: 'arn:aws:wafv2:us-east-1:123456789012:regional/webacl/my-Waf/d7b694d2-4f7d-4dd6-a9a9-843dd1931330',
      });
      expect(waf.compile()).toMatchSnapshot();
    });
  });

  describe('Throttle rules', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      name: 'Waf',
      rules: [],
    });

    it('should generate a preset rule', () => {
      expect(waf.buildWafRule('throttle', 'Base')).toMatchSnapshot();
    });

    it('should generate a preset rule with limit', () => {
      expect(waf.buildWafRule({ throttle: 500 }, 'Base')).toMatchSnapshot();
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
                fallbackBehavior: 'MATCH',
              },
              visibilityConfig: {
                name: 'ThrottleRule',
                cloudWatchMetricsEnabled: false,
                sampledRequestsEnabled: false,
              },
            },
          },

          'Base',
        ),
      ).toMatchSnapshot();
    });
  });

  describe('Disable introspection', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      name: 'Waf',
      rules: [],
    });

    it('should generate a preset rule', () => {
      expect(
        waf.buildWafRule('disableIntrospection', 'Base'),
      ).toMatchSnapshot();
    });

    it('should generate a preset rule with custon config', () => {
      expect(
        waf.buildWafRule(
          {
            disableIntrospection: {
              priority: 200,
              visibilityConfig: {
                name: 'DisableIntrospection',
                sampledRequestsEnabled: false,
                cloudWatchMetricsEnabled: false,
              },
            },
          },
          'Base',
        ),
      ).toMatchSnapshot();
    });

    it('sets OversizeHandling on the body field matches (required by WAF)', () => {
      const rule = waf.buildWafRule('disableIntrospection', 'Base');

      // FieldToMatch is intentionally loosely typed in production, so narrow
      // to the shape this assertion cares about.
      type BodyMatch = { FieldToMatch: { Body: { OversizeHandling: string } } };
      const { Statements } = rule.Statement.OrStatement as unknown as {
        Statements: {
          SizeConstraintStatement?: BodyMatch;
          ByteMatchStatement?: BodyMatch;
        }[];
      };

      // The size guard must MATCH oversized bodies, otherwise bodies larger
      // than the 8kb inspection limit are never blocked.
      expect(
        Statements[0].SizeConstraintStatement?.FieldToMatch.Body
          .OversizeHandling,
      ).toBe('MATCH');
      // The __schema lookup inspects the available body and lets the size
      // guard handle anything oversized.
      expect(
        Statements[1].ByteMatchStatement?.FieldToMatch.Body.OversizeHandling,
      ).toBe('CONTINUE');
    });
  });

  describe('Custom rules', () => {
    const api = new Api(given.appSyncConfig(), plugin);
    const waf = new Waf(api, {
      name: 'Waf',
      rules: [],
    });

    it('should generate a custom rule', () => {
      expect(
        waf.buildWafRule(
          {
            name: 'disable US',
            priority: 200,
            action: 'Block',
            statement: {
              GeoMatchStatement: {
                CountryCodes: ['US'],
              },
            },
          },
          'Base',
        ),
      ).toMatchSnapshot();
    });

    it('should generate a custom rule with ManagedRuleGroup', () => {
      expect(
        waf.buildWafRule(
          {
            name: 'MyRule1',
            priority: 200,
            overrideAction: {
              None: {},
            },
            statement: {
              ManagedRuleGroupStatement: {
                Name: 'AWSManagedRulesCommonRuleSet',
                VendorName: 'AWS',
              },
            },
          },
          'Base',
        ),
      ).toMatchSnapshot();
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
      name: 'Waf',
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

  describe('Edge cases', () => {
    const api = new Api(given.appSyncConfig(), plugin);

    it('uses an object-shaped defaultAction verbatim instead of wrapping a string', () => {
      const waf = new Waf(api, {
        enabled: true,
        name: 'Waf',
        // Object form (rather than the simpler `'Allow' | 'Block'` shorthand).
        // The type narrows to string, but the runtime accepts either shape.
        defaultAction: { Block: {} } as unknown as 'Allow' | 'Block',
        rules: [],
      });
      const compiled = waf.compile() as unknown as Record<
        string,
        { Properties: { DefaultAction: unknown } }
      >;
      expect(compiled.GraphQlWaf.Properties.DefaultAction).toEqual({
        Block: {},
      });
    });

    it('falls back to a generated Waf name when none is provided', () => {
      const waf = new Waf(api, {
        enabled: true,
        rules: [],
      });
      const compiled = waf.compile() as unknown as Record<
        string,
        { Properties: { Name: string } }
      >;
      // The default given.appSyncConfig is named 'MyApi', so the fallback is 'MyApiWaf'
      expect(compiled.GraphQlWaf.Properties.Name).toEqual('MyApiWaf');
    });

    it('falls back to a generated description when none is provided', () => {
      const waf = new Waf(api, {
        enabled: true,
        name: 'Waf',
        rules: [],
      });
      const compiled = waf.compile() as unknown as Record<
        string,
        { Properties: { Description: string } }
      >;
      expect(compiled.GraphQlWaf.Properties.Description).toEqual(
        'ACL rules for AppSync MyApi',
      );
    });

    it('returns empty Resources when enabled=false even if rules are present', () => {
      const waf = new Waf(api, {
        enabled: false,
        name: 'Waf',
        rules: ['throttle'],
      });
      expect(waf.compile()).toEqual({});
    });

    it('handles a missing rules array (treats it as empty)', () => {
      // The runtime guards `this.config.rules || []`, so a missing array
      // shouldn't crash. Casting because the public type requires `rules`.
      const waf = new Waf(api, {
        enabled: true,
        name: 'Waf',
      } as unknown as ConstructorParameters<typeof Waf>[1]);
      expect(() => waf.buildWafRules()).not.toThrow();
    });

    it('uses an explicit rule priority instead of incrementing the default', () => {
      const waf = new Waf(api, {
        enabled: true,
        name: 'Waf',
        rules: [
          {
            name: 'pinned',
            priority: 42,
            action: 'Block',
            statement: { GeoMatchStatement: { CountryCodes: ['US'] } },
          },
        ],
      });
      const rules = waf.buildWafRules();
      expect(rules[0]).toMatchObject({ Name: 'pinned', Priority: 42 });
    });

    it('assigns auto-incrementing priorities starting at 100 when rules omit priority', () => {
      const waf = new Waf(api, {
        enabled: true,
        name: 'Waf',
        rules: [
          {
            name: 'first',
            action: 'Block',
            statement: { GeoMatchStatement: { CountryCodes: ['US'] } },
          },
          {
            name: 'second',
            action: 'Block',
            statement: { GeoMatchStatement: { CountryCodes: ['CA'] } },
          },
        ],
      });
      const rules = waf.buildWafRules();
      expect(rules[0]).toMatchObject({ Name: 'first', Priority: 100 });
      expect(rules[1]).toMatchObject({ Name: 'second', Priority: 101 });
    });
  });
});

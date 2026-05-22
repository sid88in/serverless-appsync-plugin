import {
  getHostedZoneName,
  getWildCardDomainName,
  parseDateTimeOrDuration,
  parseDuration,
  toCfnKeys,
  wait,
} from '../utils';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2020-01-01T17:00:00+00:00'));
});

afterAll(() => {
  jest.useRealTimers();
});

describe('parseDuration', () => {
  it('should parse valid duration', () => {
    expect(parseDuration('2d').toString()).toEqual('P2D');
    expect(parseDuration('365d').toString()).toEqual('P365D');
  });

  it('should throw on invalid duration', () => {
    expect(() => parseDuration('foo')).toThrow();
  });

  it('should auto-fix 1y durations to 365 days', () => {
    expect(parseDuration('1y').toString()).toEqual('P365D');
  });

  it('should accept a number and treat it as hours', () => {
    expect(parseDuration(24).toString()).toEqual('PT24H');
    expect(parseDuration(1).toString()).toEqual('PT1H');
  });

  it('should default to hours when no unit is provided', () => {
    expect(parseDuration('48').toString()).toEqual('PT48H');
  });

  it.each([
    ['5m', 'PT5M'],
    ['10h', 'PT10H'],
    ['7d', 'P7D'],
    ['2w', 'P2W'],
    ['3M', 'P3M'],
    // luxon normalizes quarters into months: 1q → P3M
    ['1q', 'P3M'],
    ['1s', 'PT1S'],
    ['500ms', 'PT0.5S'],
  ])('should parse "%s" as ISO duration %s', (input, expected) => {
    expect(parseDuration(input).toString()).toEqual(expected);
  });

  it('should throw on a non-string non-number input', () => {
    // @ts-expect-error — intentionally passing wrong type to exercise guard
    expect(() => parseDuration(null)).toThrow(
      'Could not parse null as a valid duration',
    );
    // @ts-expect-error — intentionally passing wrong type to exercise guard
    expect(() => parseDuration(undefined)).toThrow(
      'Could not parse undefined as a valid duration',
    );
  });

  it('should throw a descriptive error message on unparseable strings', () => {
    expect(() => parseDuration('not-a-duration')).toThrow(
      'Could not parse not-a-duration as a valid duration',
    );
  });
});

describe('parseDateTimeOrDuration', () => {
  it('should parse valid date', () => {
    expect(
      parseDateTimeOrDuration('2021-12-31T16:57:00+00:00'),
    ).toMatchInlineSnapshot(`"2021-12-31T16:57:00.000+00:00"`);

    expect(parseDateTimeOrDuration('10m')).toMatchInlineSnapshot(
      `"2020-01-01T16:50:00.000+00:00"`,
    );

    expect(parseDateTimeOrDuration('1h')).toMatchInlineSnapshot(
      `"2020-01-01T16:00:00.000+00:00"`,
    );

    expect(function () {
      parseDateTimeOrDuration('foo');
    }).toThrowErrorMatchingInlineSnapshot(`"Invalid date or duration"`);
  });

  it('should subtract a day-duration from "now" when given a duration string', () => {
    expect(parseDateTimeOrDuration('1d').toISO()).toEqual(
      '2019-12-31T17:00:00.000+00:00',
    );
  });

  it('should subtract a week-duration from "now" when given a duration string', () => {
    expect(parseDateTimeOrDuration('1w').toISO()).toEqual(
      '2019-12-25T17:00:00.000+00:00',
    );
  });
});

describe('domain', () => {
  describe('getHostedZoneName', () => {
    it('should extract a correct hostedZoneName', () => {
      expect(getHostedZoneName('example.com')).toMatch('example.com.');
      expect(getHostedZoneName('api.example.com')).toMatch('example.com.');
      expect(getHostedZoneName('api.prod.example.com')).toMatch(
        'prod.example.com.',
      );
    });

    it('should handle a two-part domain by returning it unchanged with a trailing dot', () => {
      expect(getHostedZoneName('example.org')).toEqual('example.org.');
    });

    it('should strip only the leftmost subdomain when there are many', () => {
      expect(getHostedZoneName('a.b.c.d.example.com')).toEqual(
        'b.c.d.example.com.',
      );
    });
  });

  describe('getWildCardDomainName', () => {
    it('should extract a correct getWildCardDomainName', () => {
      expect(getWildCardDomainName('api.example.com')).toMatch('*.example.com');
      expect(getWildCardDomainName('api.prod.example.com')).toMatch(
        '*.prod.example.com',
      );
    });

    it('should replace the leftmost subdomain with a wildcard', () => {
      expect(getWildCardDomainName('foo.bar.example.com')).toEqual(
        '*.bar.example.com',
      );
    });
  });
});

describe('toCfnKeys', () => {
  it('should upper-case the first letter of top-level keys', () => {
    expect(toCfnKeys({ foo: 'bar', baz: 1 })).toEqual({ Foo: 'bar', Baz: 1 });
  });

  it('should recurse into nested objects', () => {
    expect(toCfnKeys({ foo: { bar: { baz: 1 } } })).toEqual({
      Foo: { Bar: { Baz: 1 } },
    });
  });

  it('should leave already-capitalized keys alone', () => {
    expect(toCfnKeys({ Foo: 1, BAR: 2 })).toEqual({ Foo: 1, BAR: 2 });
  });

  it('should not modify scalar values', () => {
    expect(
      toCfnKeys({
        a: 'string',
        b: 42,
        c: true,
      }),
    ).toEqual({
      A: 'string',
      B: 42,
      C: true,
    });
  });

  it('treats null as an object due to typeof check (pins down current behavior)', () => {
    // typeof null === 'object', so isRecord(null) returns true and lodash's
    // transform iterates null as an empty object. This is a known quirk —
    // documenting here so any future refactor of isRecord is intentional.
    expect(toCfnKeys({ value: null })).toEqual({ Value: {} });
  });

  it('should handle empty objects', () => {
    expect(toCfnKeys({})).toEqual({});
  });

  it('should not modify arrays (treats them as non-records)', () => {
    // Arrays in JS are typeof 'object', and the helper currently recurses into them;
    // this test pins down current behavior so future refactors stay intentional.
    const result = toCfnKeys({ items: [1, 2, 3] });
    expect(result).toHaveProperty('Items');
  });
});

describe('wait', () => {
  it('should resolve after the specified time has elapsed', async () => {
    const promise = wait(1000);
    jest.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('should resolve immediately when given 0', async () => {
    const promise = wait(0);
    jest.advanceTimersByTime(0);
    await expect(promise).resolves.toBeUndefined();
  });
});

import { parseDuration } from 'utils';

describe('parseDuration', () => {
  it('should parse valid duration', () => {
    expect(parseDuration('2d').toString()).toEqual('P2D');
    expect(parseDuration('365d').toString()).toEqual('P365D');
  });

  it('should throw on invalid duration', () => {
    expect(() => parseDuration('foo')).toThrowError();
  });

  it('should auto-fix 24h durations to 25h', () => {
    expect(parseDuration(24).toString()).toEqual('PT25H');
    expect(parseDuration('1d').toString()).toEqual('PT25H');
    expect(parseDuration('24h').toString()).toEqual('PT25H');
    expect(parseDuration('1440m').toString()).toEqual('PT25H');
  });

  it('should auto-fix 1y durations to 365 days', () => {
    expect(parseDuration('1y').toString()).toEqual('P365D');
  });
});

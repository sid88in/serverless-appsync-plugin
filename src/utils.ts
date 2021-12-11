import { upperFirst, transform, values } from 'lodash';
import { TransformKeysToCfnCase } from './typeHelpers';
import { ServerlessLogger } from 'types/serverless';
import chalk from 'chalk';
import { Duration } from 'luxon';

const timeUnits = {
  y: 'years',
  q: 'quarters',
  M: 'months',
  w: 'weeks',
  d: 'days',
  h: 'hours',
  m: 'minutes',
  s: 'seconds',
  ms: 'milliseconds',
} as const;

const units = values(timeUnits);
export type TimeUnit = typeof units[number];

const isRecord = (value?: unknown): value is Record<string, unknown> => {
  return typeof value === 'object';
};

export const toCfnKeys = <T extends Record<string, unknown>>(
  object: T,
): TransformKeysToCfnCase<T> =>
  transform(object, (acc, value, key) => {
    const newKey = typeof key === 'string' ? upperFirst(key) : key;

    acc[newKey] = isRecord(value) ? toCfnKeys(value) : value;

    return acc;
  });

export const parseDuration = (input: string | number) => {
  let duration: Duration;
  if (typeof input === 'number') {
    duration = Duration.fromDurationLike({ hours: input });
  } else if (typeof input === 'string') {
    const regexp = new RegExp(`^(\\d+)(${Object.keys(timeUnits).join('|')})$`);
    const match = input.match(regexp);
    if (match) {
      let amount: number = parseInt(match[1], 10);
      let unit = timeUnits[match[2]] as TimeUnit;

      // 1 year could be 366 days on or before leap year,
      // which would fail. Swap for 365 days
      if (input.match(/^1y(ears?)?$/)) {
        amount = 365;
        unit = 'days';
      }

      duration = Duration.fromDurationLike({ [unit]: amount });
    } else {
      throw new Error(`Could not parse ${input} as a valid duration`);
    }
  } else {
    throw new Error(`Could not parse ${input} as a valid duration`);
  }

  // Minimum duration is 1 day from 'now'
  // However, api key expiry is rounded down to the hour.
  // meaning the minimum expiry date is in fact 25 hours
  // We accept 24h durations for simplicity of use
  // but fix them to be 25
  // Anything < 24h will be kept to make sure the validation fails later
  if (duration.as('hours') >= 24 && duration.as('hours') < 25) {
    duration = Duration.fromDurationLike({ hours: 25 });
  }

  return duration;
};

export const logger: (log: (message) => void) => ServerlessLogger = (log) => ({
  error: (message) => log(chalk.red(message)),
  warning: (message) => log(chalk.yellow(message)),
  notice: (message) => log(chalk.yellow(message)),
  info: (message) => log(chalk.blueBright(message)),
  debug: log,
  success: (message) => log(chalk.green(message)),
});

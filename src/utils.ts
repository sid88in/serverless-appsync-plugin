import moment, { unitOfTime } from 'moment';
import { upperFirst, transform } from 'lodash';
import { TransformKeysToCfnCase } from './typeHelpers';

const timeUnits = [
  'years?',
  'y',
  'quarters?',
  'Q',
  'months?',
  'M',
  'weeks?',
  'w',
  'days?',
  'd',
  'hours?',
  'h',
  'minutes?',
  'm',
  'seconds?',
  's',
  'milliseconds?',
  'ms',
] as const;

export const toCfnKeys = <T extends Record<string, any>>(
  object: T,
): TransformKeysToCfnCase<T> =>
  transform(object, (acc, value, key) => {
    const newKey = typeof key === 'string' ? upperFirst(key) : key;

    // @ts-ignore
    acc[newKey] = typeof value === 'object' ? toCfnKeys(value) : value;

    return acc;
  });

export const parseDuration = (input: string) => {
  let duration;
  if (typeof input === 'number') {
    duration = moment.duration(input, 'hours');
  } else if (typeof input === 'string') {
    const regexp = new RegExp(`^(\\d+)(${timeUnits.join('|')})$`);
    const match = input.match(regexp);
    if (match) {
      let amount: number = parseInt(match[1], 10);
      let unit: unitOfTime.Base = match[2] as unitOfTime.Base;

      // 1 year could be 366 days on or before leap year,
      // which would fail. Swap for 365 days
      if (input.match(/^1y(ears?)?$/)) {
        amount = 365;
        unit = 'days';
      }

      duration = moment.duration(amount, unit || 'hours');
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
  if (duration.asHours() >= 24 && duration.asHours() < 25) {
    duration = moment.duration(25, 'hours');
  }

  return duration;
};

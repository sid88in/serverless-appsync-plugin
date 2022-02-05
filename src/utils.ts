import { upperFirst, transform, values } from 'lodash';
import { TransformKeysToCfnCase } from './typeHelpers';
import { DateTime, Duration } from 'luxon';
import { promisify } from 'util';
import * as readline from 'readline';

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

export const wait = async (time: number) => {
  await new Promise((resolve) => setTimeout(resolve, time));
};

export const parseDateTimeOrDuration = (input: string) => {
  try {
    // Try to parse a date
    let date = DateTime.fromISO(input);
    if (!date.isValid) {
      // try to parse duration
      date = DateTime.now().minus(parseDuration(input));
    }

    return date;
  } catch (error) {
    throw new Error('Invalid date or duration');
  }
};

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

  return duration;
};

export const getHostedZoneName = (domain: string) => {
  return `${domain.split('.').slice(1).join('.')}.`;
};

export const question = async (question: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const q = promisify(
    (
      question: string,
      cb: (err: object | string | null, answer: string) => void,
    ) => {
      rl.question(question, (a: string) => {
        cb(null, a);
      });
    },
  ).bind(rl);

  const answer = await q(`${question}: `);
  rl.close();

  return answer;
};

export const confirmAction = async (): Promise<boolean> => {
  const answer = await question('Do you want to continue? y/N');

  return answer.toLowerCase() === 'y';
};

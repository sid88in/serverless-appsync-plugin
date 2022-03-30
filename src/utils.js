const moment = require('moment');
const { upperFirst, transform } = require('lodash');
const { promisify } = require('util');
const readline = require('readline');

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
];

const toCfnKeys = (object) =>
  transform(object, (acc, value, key) => {
    const newKey = typeof key === 'string' ? upperFirst(key) : key;

    acc[newKey] = typeof value === 'object' ? toCfnKeys(value) : value;

    return acc;
  });

const question = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const q = promisify((question, cb) => {
    rl.question(question, (a) => {
      cb(null, a);
    });
  }).bind(rl);

  const answer = await q(`${question}: `);
  rl.close();

  return answer;
};

const confirmAction = async () => {
  const answer = await question('Do you want to continue? y/N');

  return answer.toLowerCase() === 'y';
};

const wait = async (time) => {
  await new Promise((resolve) => setTimeout(resolve, time));
};

const getHostedZoneName = (domain) => {
  return `${domain.split('.').slice(1).join('.')}.`;
};

module.exports = {
  parseDuration: (input) => {
    let duration;
    if (typeof input === 'number') {
      duration = moment.duration(input, 'hours');
    } else if (typeof input === 'string') {
      const regexp = new RegExp(`^(\\d+)(${timeUnits.join('|')})$`);
      const match = input.match(regexp);
      if (match) {
        let amount = match[1];
        let unit = match[2];

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
  },
  toCfnKeys,
  getHostedZoneName,
  confirmAction,
  wait,
};

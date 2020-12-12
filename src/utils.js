const parseStringDuration = require('parse-duration');

// override default
parseStringDuration.y = parseStringDuration.d * 365;

module.exports = {
  parseDuration: (duration) => {
    if (typeof duration === 'number') {
      return duration;
    } else if (typeof duration === 'string') {
      if (/^\d+$/.test(duration)) {
        return parseInt(duration, 10);
      }

      return parseStringDuration(duration, 's');
    }

    return duration;
  },
};

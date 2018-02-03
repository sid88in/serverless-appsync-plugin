module.exports = {
  "extends": "airbnb-base",
  "plugins": [],
  "rules": {
    "func-names": "off",
    // doesn't work in node v4 :(
    "strict": "off",
    "prefer-rest-params": "off",
    "import/no-extraneous-dependencies" : "off",
    "class-methods-use-this": "off",
    "prefer-destructuring": "off",
    "no-shadow": "off",
  },
  "env": {
   "jest": true
   }
};

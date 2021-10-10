module.exports = {
  extends: ['prettier', 'plugin:prettier/recommended', 'eslint:recommended'],
  plugins: [],
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'no-console': 'off',
    'class-methods-use-this': 'off',
  },
  env: {
    jest: true,
    node: true,
    es6: true,
  },
};

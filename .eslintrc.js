module.exports = {
  extends: [
    'prettier',
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/recommended',
    'eslint:recommended',
  ],
  plugins: [],
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    // used for tests until all errors get fixed
    '@typescript-eslint/ban-ts-comment': 'off',
    // already handled by ts/no-unused
    'no-unused-vars': 'off',
    'no-console': 'off',
    'class-methods-use-this': 'off',
  },
  env: {
    jest: true,
    node: true,
    es6: true,
  },
  ignorePatterns: ['lib/**/*', 'node_modules'],
};

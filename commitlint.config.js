export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [
      'plugin',
      'page',
      'component',
      'router',
      'compiler',
      'renderer',
      'manifest',
      'config',
      'signals',
      'hydration',
      'validator',
      'cli',
      'test',
      'docs'
    ]],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100]
  }
}

// packages/extension/eslint-rules/index.js
// Local ESLint plugin for mdx-preview extension rules

module.exports = {
  rules: {
    'no-direct-vscode-config': require('./no-direct-vscode-config'),
    'no-raw-log-tag': require('./no-raw-log-tag'),
  },
};

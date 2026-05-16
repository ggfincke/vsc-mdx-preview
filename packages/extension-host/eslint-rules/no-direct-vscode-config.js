// packages/extension-host/eslint-rules/no-direct-vscode-config.js
// enforce ConfigManager for VS Code configuration access
// allowed locations: ConfigManager.ts, tests & mocks

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct vscode.workspace.getConfiguration() calls outside ConfigManager',
      recommended: true,
    },
    messages: {
      noDirectConfig:
        'Direct vscode.workspace.getConfiguration() call detected. ' +
        'Use ConfigManager.getInstance().get() or getConfigManager().get() instead. ' +
        'See packages/extension-host/src/shared/config/ConfigManager.ts for the centralized configuration API.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Allow in ConfigManager.ts itself (the authorized location)
    if (filename.includes('ConfigManager.ts')) {
      return {};
    }

    // Allow in test files
    if (
      filename.includes('.test.') ||
      filename.includes('.integration.test.') ||
      filename.includes('__mocks__')
    ) {
      return {};
    }

    return {
      CallExpression(node) {
        // Check for pattern: vscode.workspace.getConfiguration(...)
        // This matches: vscode.workspace.getConfiguration('mdx-preview')
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'getConfiguration' &&
          node.callee.object.type === 'MemberExpression' &&
          node.callee.object.property.name === 'workspace'
        ) {
          // Check if the object is 'vscode' (could be imported or namespaced)
          const workspaceObj = node.callee.object.object;
          if (
            workspaceObj &&
            (workspaceObj.name === 'vscode' ||
              (workspaceObj.type === 'Identifier' &&
                workspaceObj.name === 'vscode'))
          ) {
            context.report({
              node,
              messageId: 'noDirectConfig',
            });
          }
        }
      },
    };
  },
};

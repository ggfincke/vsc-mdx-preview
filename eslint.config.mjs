// eslint.config.mjs
// ESLint configuration for extension & webview packages

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Local custom rules for mdx-preview
import localRules from './packages/extension/eslint-rules/index.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      // L.3 optimization: enable incremental type-checking
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      local: localRules,
    },
    rules: {
      // migrated from tslint.json
      'no-throw-literal': 'error',
      'no-unused-expressions': 'warn',
      curly: 'error',
      eqeqeq: ['error', 'always'],

      // TypeScript-specific
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // some dynamic requires are intentional
      '@typescript-eslint/no-require-imports': 'off',

      // Custom local rules
      // Enforce ConfigManager usage for VS Code configuration access
      'local/no-direct-vscode-config': 'error',
    },
  },
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'examples/**',
      '.vscode-test/**',
      // has its own eslint.config.mjs
      'packages/webview-app/**',
      // plain JS files not in tsconfig
      '**/*.mjs',
      // local eslint rules (plain JS)
      'packages/extension/eslint-rules/**',
      // test files (not in main tsconfig, tests currently disabled)
      '**/*.test.ts',
      '**/*.integration.test.ts',
      'packages/extension/test/**',
    ],
  }
);

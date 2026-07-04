// eslint.config.mjs
// ESLint configuration for extension & webview packages

import tseslint from 'typescript-eslint';
import globals from 'globals';

import {
  baseConfig,
  sharedRemovedImportPattern,
} from './packages/extension-host/eslint-rules/eslint-base.mjs';

export default tseslint.config(
  ...baseConfig(import.meta.dirname),
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // migrated from tslint.json
      'no-throw-literal': 'error',

      // some dynamic requires are intentional
      '@typescript-eslint/no-require-imports': 'off',

      // Cross-package boundary enforcement
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'gray-matter',
              message:
                'Use safeMatter from mdx-forge/compiler; raw gray-matter evals ---js frontmatter (CWE-94).',
            },
          ],
          patterns: [
            {
              group: ['gray-matter/*'],
              message:
                'Use safeMatter from mdx-forge/compiler; raw gray-matter evals ---js frontmatter (CWE-94).',
            },
            {
              group: ['**/webview-client/**'],
              message:
                'Extension/shared code must not import from webview-client.',
            },
            sharedRemovedImportPattern,
          ],
        },
      ],

      // Custom local rules
      // Enforce ConfigManager usage for VS Code configuration access
      'local/no-direct-vscode-config': 'error',
      // Enforce createTaggedLogger over manual tag interpolation
      'local/prefer-tagged-logger': 'error',
    },
  },
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'examples/**',
      '.vscode-test/**',
      // has its own eslint.config.mjs
      'packages/webview-client/**',
      // plain JS files not in tsconfig
      '**/*.mjs',
      // package-local vitest configs are outside main tsconfig scopes
      '**/vitest.config.ts',
      // local eslint rules (plain JS)
      'packages/extension-host/eslint-rules/**',
      // test files (not in main tsconfig, tests currently disabled)
      '**/*.test.ts',
      '**/*.integration.test.ts',
      'packages/extension-host/test/**',
    ],
  }
);

// packages/extension-host/eslint-rules/eslint-base.mjs
// shared flat-config base for extension & webview ESLint configs

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

import localRules from './index.js';

// shared no-restricted-imports guard: @mdx-preview/shared was removed
export const sharedRemovedImportPattern = {
  group: ['@mdx-preview/shared', '@mdx-preview/shared/*'],
  message:
    'packages/shared was removed. Import from @mdx-preview/contracts or @mdx-preview/runtime-utils.',
};

// build the shared base array; tsconfigRootDir is path-specific per consumer
export function baseConfig(tsconfigRootDir) {
  return [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        // L.3 optimization: enable incremental type-checking
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        local: localRules,
      },
      rules: {
        // migrated from tslint.json
        'no-unused-expressions': 'warn',
        curly: 'error',
        eqeqeq: ['error', 'always'],

        // TypeScript-specific
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-explicit-any': 'warn',

        // Enforce LogTags usage for log prefixes
        'local/no-raw-log-tag': 'error',
      },
    },
  ];
}

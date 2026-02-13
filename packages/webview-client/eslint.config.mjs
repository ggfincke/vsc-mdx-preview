// packages/webview-client/eslint.config.mjs
// ESLint configuration for webview React app

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import localRules from '../extension-host/eslint-rules/index.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        // L.3 optimization: enable incremental type-checking
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      local: localRules,
    },
    rules: {
      // React hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React refresh
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TypeScript-specific
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Cross-package boundary enforcement
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/extension-host/**', '**/extension/**'],
              message: 'Webview code must not import from extension-host.',
            },
            {
              group: ['@mdx-preview/shared', '@mdx-preview/shared/*'],
              message:
                'packages/shared was removed. Import from @mdx-preview/contracts or @mdx-preview/runtime-utils.',
            },
          ],
        },
      ],

      // General
      'no-unused-expressions': 'warn',
      curly: 'error',
      eqeqeq: ['error', 'always'],

      // enforce local lint rules
      'local/no-raw-log-tag': 'error',
    },
  },
  // Context files export both Provider components & useX hooks by design (exception: react-refresh rule)
  // This is the standard React Context pattern & a known exception to Fast Refresh
  {
    files: ['**/context.tsx', '**/*Context.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Shim files use factory patterns (createCodeBlock, createNextraWrapper, Object.assign)
  // that react-refresh can't statically analyze as components
  {
    files: ['**/shims/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts'],
  }
);

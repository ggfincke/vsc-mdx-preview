// packages/webview-client/eslint.config.mjs
// ESLint configuration for webview React app

import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import {
  baseConfig,
  sharedRemovedImportPattern,
} from '../extension-host/eslint-rules/eslint-base.mjs';

export default tseslint.config(
  ...baseConfig(import.meta.dirname),
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
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
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

      // Cross-package boundary enforcement
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/extension-host/**', '**/extension/**'],
              message: 'Webview code must not import from extension-host.',
            },
            sharedRemovedImportPattern,
          ],
        },
      ],
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
  // useAsyncEffect forwards caller-provided deps to useEffect, which the
  // react-hooks plugin can't statically verify (known limitation)
  {
    files: ['**/hooks/useAsyncEffect.ts'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts'],
  }
);

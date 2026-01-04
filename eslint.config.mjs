import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.json',
      },
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
    ],
  }
);

// tests/vitest.config.ts
// Vitest config for integration tests

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    testTimeout: 10000,
    globals: true,
    alias: {
      vscode: path.resolve(__dirname, '../packages/extension/test/__mocks__/vscode.ts'),
      '@mdx-preview/shared': path.resolve(__dirname, '../packages/shared/index.ts'),
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, '../packages/extension/test/__mocks__/vscode.ts'),
      '@mdx-preview/shared': path.resolve(__dirname, '../packages/shared/index.ts'),
    },
  },
});

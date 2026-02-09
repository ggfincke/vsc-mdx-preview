// tests/vitest.config.ts
// Vitest config for all tests

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
      vscode: path.resolve(
        __dirname,
        '../packages/extension-host/test/__mocks__/vscode.ts'
      ),
      '@mdx-preview/shared': path.resolve(
        __dirname,
        '../packages/shared/index.ts'
      ),
      '@mdx-preview/contracts': path.resolve(
        __dirname,
        '../packages/contracts/src/index.ts'
      ),
      '@mdx-preview/registry': path.resolve(
        __dirname,
        '../packages/registry/src/index.ts'
      ),
      '@mdx-preview/runtime-utils': path.resolve(
        __dirname,
        '../packages/runtime-utils/src/index.ts'
      ),
      '@mdx-preview/codegen': path.resolve(
        __dirname,
        '../packages/codegen/src/index.ts'
      ),
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(
        __dirname,
        '../packages/extension-host/test/__mocks__/vscode.ts'
      ),
      '@mdx-preview/shared': path.resolve(
        __dirname,
        '../packages/shared/index.ts'
      ),
      '@mdx-preview/contracts': path.resolve(
        __dirname,
        '../packages/contracts/src/index.ts'
      ),
      '@mdx-preview/registry': path.resolve(
        __dirname,
        '../packages/registry/src/index.ts'
      ),
      '@mdx-preview/runtime-utils': path.resolve(
        __dirname,
        '../packages/runtime-utils/src/index.ts'
      ),
      '@mdx-preview/codegen': path.resolve(
        __dirname,
        '../packages/codegen/src/index.ts'
      ),
    },
  },
});

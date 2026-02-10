import { defineConfig } from 'vitest/config';
import path from 'path';

const aliases = [
  {
    find: 'vscode',
    replacement: path.resolve(
      __dirname,
      '../packages/extension-host/test/__mocks__/vscode.ts'
    ),
  },
  {
    find: '@mdx-preview/contracts',
    replacement: path.resolve(__dirname, '../packages/contracts/src/index.ts'),
  },
  {
    find: '@mdx-preview/registry',
    replacement: path.resolve(__dirname, '../packages/registry/src/index.ts'),
  },
  {
    find: '@mdx-preview/runtime-utils',
    replacement: path.resolve(
      __dirname,
      '../packages/runtime-utils/src/index.ts'
    ),
  },
  {
    find: '@mdx-preview/codegen',
    replacement: path.resolve(__dirname, '../packages/codegen/src/index.ts'),
  },
];

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    testTimeout: 10000,
    globals: true,
    alias: aliases,
  },
  resolve: {
    alias: aliases,
  },
});

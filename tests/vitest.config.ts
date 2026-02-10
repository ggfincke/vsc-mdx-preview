import { defineConfig } from 'vitest/config';
import path from 'path';

const mdxToolsSrc = path.resolve(__dirname, '../packages/mdx-tools/src');

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
  {
    find: /^mdx-tools\/compiler\/plugins$/,
    replacement: path.resolve(mdxToolsSrc, 'compiler/plugins/index.ts'),
  },
  {
    find: /^mdx-tools\/compiler\/transforms$/,
    replacement: path.resolve(mdxToolsSrc, 'compiler/transforms/index.ts'),
  },
  {
    find: /^mdx-tools\/compiler\/(.*)$/,
    replacement: `${mdxToolsSrc}/compiler/$1`,
  },
  {
    find: 'mdx-tools/compiler',
    replacement: path.resolve(mdxToolsSrc, 'compiler/index.ts'),
  },
  {
    find: /^mdx-tools\/browser\/registry$/,
    replacement: path.resolve(mdxToolsSrc, 'browser/registry/index.ts'),
  },
  {
    find: /^mdx-tools\/browser\/(.*)$/,
    replacement: `${mdxToolsSrc}/browser/$1`,
  },
  {
    find: 'mdx-tools/browser',
    replacement: path.resolve(mdxToolsSrc, 'browser/index.ts'),
  },
  {
    find: /^mdx-tools\/components\/styles\/(.+\.css)$/,
    replacement: `${mdxToolsSrc}/components/styles/$1`,
  },
  {
    find: /^mdx-tools\/components\/registry$/,
    replacement: path.resolve(mdxToolsSrc, 'components/registry/index.ts'),
  },
  {
    find: /^mdx-tools\/components\/(.*)$/,
    replacement: `${mdxToolsSrc}/components/$1`,
  },
  {
    find: 'mdx-tools/components',
    replacement: path.resolve(mdxToolsSrc, 'components/index.ts'),
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

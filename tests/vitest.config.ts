// tests/vitest.config.ts
// vitest test configuration
import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';
import path from 'path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

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

// resolve react peer deps from this project's node_modules so symlinked
// mdx-forge doesn't fail w/ __vite-optional-peer-dep virtual modules
function resolveReactPeerDeps(): Plugin {
  const reactPaths: Record<string, string> = {};
  // webview workspace first so react 19 takes priority over root react 18
  const resolvePaths = [
    path.resolve(__dirname, '../packages/webview-client/node_modules'),
    path.resolve(__dirname, '../node_modules'),
  ];
  for (const subpath of [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/client',
    'react-dom/server',
  ]) {
    try {
      reactPaths[subpath] = require.resolve(subpath, { paths: resolvePaths });
    } catch {
      // skip if not installed
    }
  }

  return {
    name: 'resolve-react-peer-deps',
    enforce: 'pre',
    resolveId(id) {
      if (id in reactPaths) {
        return { id: reactPaths[id], external: false };
      }
    },
  };
}

export default defineConfig({
  plugins: [resolveReactPeerDeps()],
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
    dedupe: ['mdx-forge'],
  },
});

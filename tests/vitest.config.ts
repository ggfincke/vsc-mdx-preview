// tests/vitest.config.ts
// vitest test configuration
import fs from 'fs';
import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';
import path from 'path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const installedMdxForgeRoot = path.resolve(__dirname, '../node_modules/mdx-forge');
const siblingMdxForgeRoot = path.resolve(__dirname, '../../mdx-forge');

function resolveMdxForgePath(
  sourceRelativePath: string,
  distRelativePath: string
): string {
  for (const root of [installedMdxForgeRoot, siblingMdxForgeRoot]) {
    const sourcePath = path.resolve(root, sourceRelativePath);
    if (fs.existsSync(sourcePath)) {
      return sourcePath;
    }
  }

  for (const root of [installedMdxForgeRoot, siblingMdxForgeRoot]) {
    const distPath = path.resolve(root, distRelativePath);
    if (fs.existsSync(distPath)) {
      return distPath;
    }
  }

  throw new Error(`Could not resolve mdx-forge path for ${sourceRelativePath}`);
}

// single-source for the mdx-forge subpath aliases (add/remove subpaths here)
const mdxForgeAliases = [
  {
    find: 'mdx-forge/browser/registry',
    replacement: resolveMdxForgePath(
      'src/browser/registry/index.ts',
      'dist/esm/browser/registry/index.js'
    ),
  },
  {
    find: 'mdx-forge/browser',
    replacement: resolveMdxForgePath(
      'src/browser/index.ts',
      'dist/esm/browser/index.js'
    ),
  },
  {
    find: 'mdx-forge/compiler',
    replacement: resolveMdxForgePath(
      'src/compiler/index.ts',
      'dist/esm/compiler/index.js'
    ),
  },
  {
    find: 'mdx-forge/diagnostics/analyze',
    replacement: resolveMdxForgePath(
      'src/diagnostics/analyze/index.ts',
      'dist/esm/diagnostics/analyze/index.js'
    ),
  },
  {
    find: 'mdx-forge/diagnostics',
    replacement: resolveMdxForgePath(
      'src/diagnostics/index.ts',
      'dist/esm/diagnostics/index.js'
    ),
  },
  {
    find: 'mdx-forge/components/registry',
    replacement: resolveMdxForgePath(
      'src/components/registry/index.ts',
      'dist/esm/components/registry/index.js'
    ),
  },
  {
    find: 'mdx-forge/components/generic',
    replacement: resolveMdxForgePath(
      'src/components/generic/index.ts',
      'dist/esm/components/generic/index.js'
    ),
  },
  {
    find: 'mdx-forge/components/docusaurus',
    replacement: resolveMdxForgePath(
      'src/components/docusaurus/index.ts',
      'dist/esm/components/docusaurus/index.js'
    ),
  },
  {
    find: 'mdx-forge/components/starlight',
    replacement: resolveMdxForgePath(
      'src/components/starlight/index.ts',
      'dist/esm/components/starlight/index.js'
    ),
  },
  {
    find: 'mdx-forge/components/nextra',
    replacement: resolveMdxForgePath(
      'src/components/nextra/index.ts',
      'dist/esm/components/nextra/index.js'
    ),
  },
  {
    find: 'mdx-forge/components/nextjs',
    replacement: resolveMdxForgePath(
      'src/components/nextjs/index.ts',
      'dist/esm/components/nextjs/index.js'
    ),
  },
];

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
  ...mdxForgeAliases,
];

// load .md files as raw text strings (matches esbuild's text loader)
function rawMarkdownLoader(): Plugin {
  return {
    name: 'raw-markdown-loader',
    transform(code, id) {
      if (id.endsWith('.md')) {
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null,
        };
      }
    },
  };
}

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
  plugins: [rawMarkdownLoader(), resolveReactPeerDeps()],
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

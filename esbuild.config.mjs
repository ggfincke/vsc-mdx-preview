// esbuild.config.mjs
// bundle extension w/ ESM support

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// @type {esbuild.BuildOptions}
const buildOptions = {
  entryPoints: ['packages/extension-host/src/entry/activate.ts'],
  bundle: true,
  outfile: 'build/extension/extension.js',
  // exclude runtime-provided & optional workspace deps from bundle
  // babel metadata, sass, & typescript are loaded dynamically
  external: [
    'vscode',
    '@babel/preset-typescript/package.json',
    'sass',
    'typescript',
  ],
  // VS Code extension host requires CommonJS
  format: 'cjs',
  // esbuild lowers import.meta to an empty object in CJS output, so bundled ESM
  // sources (e.g. @babel/core) crash in createRequire w/ undefined filename
  // Shim import.meta.url w/ the CJS equivalent derived from __filename
  banner: {
    js: "const import_meta_url = require('node:url').pathToFileURL(__filename).href;",
  },
  define: {
    'import.meta.url': 'import_meta_url',
  },
  platform: 'node',
  target: 'node20',
  sourcemap: !production,
  minify: production,
  // handle ESM-only packages by bundling them (browser first for smaller bundles)
  mainFields: ['browser', 'module', 'main'],
  // preserve dynamic imports for code splitting if needed
  splitting: false,
  // tree shaking
  treeShaking: true,
  // handle .node native modules
  loader: {
    '.node': 'copy',
    '.md': 'text',
  },
  // log level
  logLevel: 'info',

  // production-only optimizations
  ...(production && {
    // remove debugger statements
    drop: ['debugger'],
    // mark pure functions (can be removed if return value unused) - L.5 optimization
    pure: [
      'console.debug',
      'console.trace',
      'Object.freeze',
      'Object.seal',
      'Object.preventExtensions',
    ],
    // strip license comments to reduce bundle size
    legalComments: 'none',
  }),
};

async function build() {
  try {
    if (watch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

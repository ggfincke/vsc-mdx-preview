// esbuild.config.mjs
// bundle extension w/ ESM support

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// @type {esbuild.BuildOptions}
const buildOptions = {
  entryPoints: ['packages/extension/extension.ts'],
  bundle: true,
  outfile: 'build/extension/extension.js',
  // vscode is provided by VS Code at runtime
  // @babel/preset-typescript/package.json is dynamically required by @babel/core
  // for module type detection (optional, not used in this project)
  // sass is loaded from workspace's node_modules at runtime (not bundled)
  // typescript is replaced with tsconfck + Sucrase (not bundled)
  external: ['vscode', '@babel/preset-typescript/package.json', 'sass', 'typescript'],
  // VS Code extension host requires CommonJS
  format: 'cjs',
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

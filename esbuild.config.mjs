// esbuild.config.mjs
// Bundle extension with ESM support

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
  external: ['vscode'],
  // VS Code extension host requires CommonJS
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !production,
  minify: production,
  // handle ESM-only packages by bundling them
  mainFields: ['module', 'main'],
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

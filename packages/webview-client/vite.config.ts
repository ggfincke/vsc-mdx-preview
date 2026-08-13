// packages/webview-client/vite.config.ts
// Vite build config for webview React app

/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import path from 'node:path';

const MODULE_PROVENANCE_FILE = '.vite/module-provenance.json';

// retain module IDs after bundling so size checks do not depend on chunk names
function moduleProvenancePlugin(): Plugin {
  return {
    name: 'module-provenance',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const manifest = Object.values(bundle).find(
          (output) =>
            output.type === 'asset' && output.fileName === '.vite/manifest.json'
        );
        if (!manifest) {
          throw new Error('Vite manifest asset is unavailable for provenance');
        }
        const manifestSha256 = createHash('sha256')
          .update(manifest.source)
          .digest('hex');
        const chunks: Record<
          string,
          {
            sha256: string;
            modules: string[];
          }
        > = {};
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') {
            continue;
          }
          chunks[output.fileName] = {
            sha256: createHash('sha256').update(output.code).digest('hex'),
            modules: Object.keys(output.modules).sort(),
          };
        }

        const sortedChunks = Object.fromEntries(
          Object.entries(chunks).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        );
        this.emitFile({
          type: 'asset',
          fileName: MODULE_PROVENANCE_FILE,
          source: `${JSON.stringify({ version: 2, manifestSha256, chunks: sortedChunks }, null, 2)}\n`,
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), moduleProvenancePlugin()],
  resolve: {
    alias: [
      {
        find: '@mdx-preview/contracts',
        replacement: path.resolve(__dirname, '../contracts/src/index.ts'),
      },
      {
        find: '@mdx-preview/runtime-utils',
        replacement: path.resolve(__dirname, '../runtime-utils/src/index.ts'),
      },
    ],
    // dedupe react so symlinked mdx-forge resolves peer deps from this project
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  // use relative base so dynamic chunk imports resolve relative to main.js
  // (not the document's base href which points to the MDX file's directory)
  base: './',
  build: {
    outDir: '../../build/webview-app',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // generate predictable file names for the extension to reference
        entryFileNames: 'static/js/main.js',
        chunkFileNames: 'static/js/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'static/css/main.css';
          }
          return 'static/media/[name][extname]';
        },
        // code splitting for heavy dependencies (M.4 optimization)
        manualChunks(id) {
          // exclude CSS files — Rolldown mishandles CSS-only namespace
          // exports when forced into a JS chunk (katex_min_exports bug)
          if (id.endsWith('.css')) {
            return;
          }
          if (id.includes('node_modules/@viz-js/viz/')) {
            return 'graphviz';
          }
          if (id.includes('node_modules/katex/')) {
            return 'katex';
          }
          if (id.includes('node_modules/dompurify/')) {
            return 'dompurify';
          }
        },
      },
    },
    manifest: true,
  },
  define: {
    // only set NODE_ENV to production for build, not for tests
    'process.env.NODE_ENV': JSON.stringify(
      process.env.VITEST ? 'development' : 'production'
    ),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});

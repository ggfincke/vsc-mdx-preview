// packages/webview-client/vite.config.ts
// Vite build config for webview React app

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^mdx-tools\/components\/styles\/(.+\.css)$/,
        replacement: path.resolve(
          __dirname,
          '../mdx-tools/src/components/styles/$1'
        ),
      },
      {
        find: /^mdx-tools\/components\/(.+)$/,
        replacement: path.resolve(__dirname, '../mdx-tools/src/components/$1'),
      },
      {
        find: /^mdx-tools\/browser\/(.+)$/,
        replacement: path.resolve(__dirname, '../mdx-tools/src/browser/$1'),
      },
      {
        find: 'mdx-tools/browser',
        replacement: path.resolve(
          __dirname,
          '../mdx-tools/src/browser/index.ts'
        ),
      },
    ],
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
        manualChunks: {
          mermaid: ['mermaid'],
          graphviz: ['@viz-js/viz'],
          katex: ['katex'],
          dompurify: ['dompurify'],
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

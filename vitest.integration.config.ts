import { defineConfig } from 'vitest/config';
import { vsCodeWorker } from 'vitest-environment-vscode';

export default defineConfig({
  test: {
    // Use vitest-environment-vscode pool for VS Code integration tests
    pool: vsCodeWorker({
      reuseWorker: true,
      version: 'stable',
    }),
    include: ['packages/extension/test/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**'],
    // Longer timeouts for integration tests (VS Code startup takes time)
    testTimeout: 60000,
    hookTimeout: 60000,
    // Mark vscode as external so the real API is used
    server: {
      deps: {
        external: [/^vscode$/],
      },
    },
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },
});

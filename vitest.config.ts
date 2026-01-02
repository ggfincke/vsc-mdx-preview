import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/extension/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/transpiler.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/node_modules/**', '**/test/**'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
    alias: {
      vscode: new URL(
        './packages/extension/test/__mocks__/vscode.ts',
        import.meta.url
      ).pathname,
    },
    clearMocks: true,
    restoreMocks: true,
  },
});

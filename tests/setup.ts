// tests/setup.ts
// global test setup & mocks

import { vi, beforeEach, afterEach } from 'vitest';

// mock logging to prevent noise in test output
vi.mock('../packages/extension/logging', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// mock services w/ sensible defaults (tests can override as needed)
vi.mock('../packages/extension/services', () => ({
  getConfigManager: vi.fn(() => ({
    get: vi.fn((key: string) => {
      const defaults: Record<string, unknown> = {
        'preview.enableScripts': true,
        'components.builtins': true,
        'components.unknownBehavior': 'placeholder',
        'build.useSucraseTranspiler': false,
      };
      return defaults[key];
    }),
  })),
  getTrustManager: vi.fn(() => ({
    getState: vi.fn(() => ({ canExecute: false })),
    subscribe: vi.fn(() => ({ dispose: () => {} })),
  })),
  getFrameworkDetector: vi.fn(() => ({
    getFramework: vi.fn(() => ({ framework: 'generic', confidence: 1 })),
    areShimsEnabled: vi.fn(() => true),
  })),
  getErrorReporter: vi.fn(() => ({
    report: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// tests/setup.ts
// global test setup & mocks

import { vi, beforeEach, afterEach } from 'vitest';

// mock logging to prevent noise in test output
vi.mock('../packages/extension-host/src/shared/logging/logger', () => ({
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

// mock services w/ stable singletons from mock-services helper
// tests import & configure these singletons directly instead of overriding
vi.mock('../packages/extension-host/src/app/services', async () => {
  const { getServicesMockModule } = await import('./helpers/mock-services');
  return getServicesMockModule();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

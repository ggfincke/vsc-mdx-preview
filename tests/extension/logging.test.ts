// tests/extension/logging.test.ts
// tests for conditional debug logging
// Note: The logging module is globally mocked in setup.ts
// We use vi.unmock to test the real implementation

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Unmock the logging module for these tests so we test the real implementation
vi.unmock('../../packages/extension/logging');

// Mock vscode before importing the logging module
vi.mock('vscode', () => {
  const mockChannel = {
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    window: {
      createOutputChannel: vi.fn(() => mockChannel),
    },
  };
});

describe('logging module', () => {
  describe('exports', () => {
    it('exports all expected functions', async () => {
      const logging = await import('../../packages/extension/logging');

      expect(typeof logging.debug).toBe('function');
      expect(typeof logging.debugLazy).toBe('function');
      expect(typeof logging.info).toBe('function');
      expect(typeof logging.warn).toBe('function');
      expect(typeof logging.error).toBe('function');
      expect(typeof logging.log).toBe('function');
      expect(typeof logging.getOutputChannel).toBe('function');
      expect(typeof logging.showOutput).toBe('function');
      expect(typeof logging.disposeOutputChannel).toBe('function');
    });

    it('exports LogLevel enum', async () => {
      const { LogLevel } = await import('../../packages/extension/logging');

      expect(LogLevel.Debug).toBe('DEBUG');
      expect(LogLevel.Info).toBe('INFO');
      expect(LogLevel.Warn).toBe('WARN');
      expect(LogLevel.Error).toBe('ERROR');
    });
  });

  describe('debug behavior when DEBUG disabled (default)', () => {
    it('debug() does not throw', async () => {
      const { debug } = await import('../../packages/extension/logging');
      expect(() => debug('test message')).not.toThrow();
    });

    it('debugLazy() does not call the message function', async () => {
      const { debugLazy } = await import('../../packages/extension/logging');
      const messageFn = vi.fn(() => 'expensive message');

      debugLazy(messageFn);

      // Message function should not be called when debug is disabled
      expect(messageFn).not.toHaveBeenCalled();
    });
  });

  describe('other log levels', () => {
    it('info() does not throw', async () => {
      const { info } = await import('../../packages/extension/logging');
      expect(() => info('test message')).not.toThrow();
      expect(() => info('test with data', { key: 'value' })).not.toThrow();
    });

    it('warn() does not throw', async () => {
      const { warn } = await import('../../packages/extension/logging');
      expect(() => warn('test message')).not.toThrow();
    });

    it('error() does not throw', async () => {
      const { error } = await import('../../packages/extension/logging');
      expect(() => error('test message')).not.toThrow();
    });
  });
});

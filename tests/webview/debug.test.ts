// tests/webview/debug.test.ts
// tests for webview debug logging utilities

import { describe, it, expect } from 'vitest';

describe('webview debug utilities', () => {
  describe('exports', () => {
    it('exports all expected functions', async () => {
      const mod = await import(
        '../../packages/webview-app/src/utils/debug'
      );

      expect(typeof mod.debug).toBe('function');
      expect(typeof mod.info).toBe('function');
      expect(typeof mod.warn).toBe('function');
      expect(typeof mod.error).toBe('function');
      expect(typeof mod.debugGroup).toBe('function');
      expect(typeof mod.debugGroupEnd).toBe('function');
      expect(typeof mod.createTaggedLogger).toBe('function');
    });

    it('exports logger object', async () => {
      const { logger } = await import(
        '../../packages/webview-app/src/utils/debug'
      );

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('createTaggedLogger', () => {
    it('creates a logger w/ all methods', async () => {
      const { createTaggedLogger } = await import(
        '../../packages/webview-app/src/utils/debug'
      );
      const log = createTaggedLogger('TEST');

      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
    });

    it('methods do not throw', async () => {
      const { createTaggedLogger } = await import(
        '../../packages/webview-app/src/utils/debug'
      );
      const log = createTaggedLogger('TEST');

      expect(() => log.debug('test')).not.toThrow();
      expect(() => log.info('test', 'data')).not.toThrow();
      expect(() => log.warn('test')).not.toThrow();
      expect(() => log.error('test')).not.toThrow();
    });
  });
});

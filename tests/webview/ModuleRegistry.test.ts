// tests/webview/ModuleRegistry.test.ts
// Unit tests for ModuleRegistry style tracking & resolution cleanup

import { describe, it, expect, vi } from 'vitest';

async function createRegistry() {
  vi.resetModules();
  const module =
    await import('mdx-forge/browser/registry');
  return new module.ModuleRegistry();
}

describe('ModuleRegistry', () => {
  describe('style tracking', () => {
    it('should add new style with refCount 1', async () => {
      const registry = await createRegistry();

      registry.markStyleInjected('style-1');

      expect(registry.hasInjectedStyle('style-1')).toBe(true);
      expect(registry.getStats().styles).toBe(1);
    });

    it('should move style to unreferenced when refCount hits 0', async () => {
      const registry = await createRegistry();

      registry.markStyleInjected('style-1');
      registry.decrementStyleRef('style-1');

      expect(registry.hasInjectedStyle('style-1')).toBe(true);
      expect(registry.getStats().styles).toBe(1);
    });

    it('should not evict referenced styles', async () => {
      const registry = await createRegistry();
      registry.configureLRU({ maxStyles: 2 });

      registry.markStyleInjected('style-1');
      registry.markStyleInjected('style-2');
      registry.markStyleInjected('style-3');

      // All should still exist (capacity exceeded but can't evict)
      expect(registry.hasInjectedStyle('style-1')).toBe(true);
      expect(registry.hasInjectedStyle('style-2')).toBe(true);
      expect(registry.hasInjectedStyle('style-3')).toBe(true);
    });

  });

  describe('dependency tracking', () => {
    it('should cascade invalidation through dependency chain', async () => {
      const registry = await createRegistry();

      registry.set('/a.js', { id: '/a.js', exports: {}, loaded: true });
      registry.set('/b.js', { id: '/b.js', exports: {}, loaded: true });
      registry.set('/c.js', { id: '/c.js', exports: {}, loaded: true });
      registry.addDependency('/a.js', '/b.js');
      registry.addDependency('/b.js', '/c.js');

      registry.setResolution('/a.js', './b', '/b.js');
      registry.setResolution('/b.js', './c', '/c.js');

      const invalidated = registry.invalidateWithDependents('/c.js');

      expect(invalidated.has('/c.js')).toBe(true);
      expect(invalidated.has('/b.js')).toBe(true);
      expect(invalidated.has('/a.js')).toBe(true);
      expect(registry.getResolution('/a.js', './b')).toBeUndefined();
      expect(registry.getResolution('/b.js', './c')).toBeUndefined();
    });
  });
});

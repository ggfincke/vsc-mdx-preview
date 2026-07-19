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
    it('should track injected css bytes for a module', async () => {
      const registry = await createRegistry();

      registry.trackStyleInjected('/a.css', 'body{color:red}');

      expect(registry.hasInjectedStyle('/a.css')).toBe(true);
      expect(registry.getInjectedCss('/a.css')).toBe('body{color:red}');
      expect(registry.getStats().styles).toBe(1);
    });

    // the cached module owns its style, so invalidation drops both
    it('should untrack a style when its owning module is invalidated', async () => {
      const registry = await createRegistry();

      registry.set('/a.css', { id: '/a.css', exports: {}, loaded: true });
      registry.trackStyleInjected('/a.css', 'body{color:red}');

      registry.invalidate('/a.css');

      expect(registry.hasInjectedStyle('/a.css')).toBe(false);
      expect(registry.getStats().styles).toBe(0);
    });

    it('should not evict styles whose owning module is still cached', async () => {
      const registry = await createRegistry();
      registry.configureLRU({ maxStyles: 2 });

      // a live owning module protects its style from capacity eviction
      for (const id of ['/a.css', '/b.css', '/c.css']) {
        registry.set(id, { id, exports: {}, loaded: true });
        registry.trackStyleInjected(id, 'body{}');
      }

      expect(registry.hasInjectedStyle('/a.css')).toBe(true);
      expect(registry.hasInjectedStyle('/b.css')).toBe(true);
      expect(registry.hasInjectedStyle('/c.css')).toBe(true);
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

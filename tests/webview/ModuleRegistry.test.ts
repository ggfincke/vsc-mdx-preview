// tests/webview/ModuleRegistry.test.ts
// Unit tests for ModuleRegistry style tracking & resolution cleanup

import { describe, it, expect, vi } from 'vitest';

async function createRegistry() {
  vi.resetModules();
  const module = await import(
    '../../packages/webview-app/src/module-system/registry/ModuleRegistry'
  );
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

    it('should increment refCount on repeated injection', async () => {
      const registry = await createRegistry();

      registry.markStyleInjected('style-1');
      registry.markStyleInjected('style-1');

      expect(registry.getStats().styles).toBe(1);
      expect(registry.hasInjectedStyle('style-1')).toBe(true);
    });

    it('should move style to unreferenced when refCount hits 0', async () => {
      const registry = await createRegistry();

      registry.markStyleInjected('style-1');
      registry.decrementStyleRef('style-1');

      expect(registry.hasInjectedStyle('style-1')).toBe(true);
      expect(registry.getStats().styles).toBe(1);
    });

    it('should evict oldest unreferenced style when at capacity', async () => {
      const registry = await createRegistry();
      registry.configureLRU({ maxStyles: 3 });

      // Fill to capacity w/ unreferenced styles
      registry.markStyleInjected('style-1');
      registry.decrementStyleRef('style-1');
      registry.markStyleInjected('style-2');
      registry.decrementStyleRef('style-2');
      registry.markStyleInjected('style-3');
      registry.decrementStyleRef('style-3');

      // Add one more (should evict style-1 as oldest)
      registry.markStyleInjected('style-4');

      expect(registry.hasInjectedStyle('style-1')).toBe(false);
      expect(registry.hasInjectedStyle('style-2')).toBe(true);
      expect(registry.hasInjectedStyle('style-4')).toBe(true);
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

    it('should clear both referenced and unreferenced styles', async () => {
      const registry = await createRegistry();

      registry.markStyleInjected('style-1');
      registry.markStyleInjected('style-2');
      registry.decrementStyleRef('style-2');

      registry.clearInjectedStyles();

      expect(registry.hasInjectedStyle('style-1')).toBe(false);
      expect(registry.hasInjectedStyle('style-2')).toBe(false);
    });
  });

  describe('resolution map', () => {
    it('should store and retrieve resolution', async () => {
      const registry = await createRegistry();

      registry.setResolution('/parent.js', './child', '/child.js');

      expect(registry.getResolution('/parent.js', './child')).toBe('/child.js');
    });

    it('should clean resolutions when parent is invalidated', async () => {
      const registry = await createRegistry();

      registry.setResolution('/parent.js', './child1', '/child1.js');
      registry.setResolution('/parent.js', './child2', '/child2.js');
      registry.setResolution('/other.js', './other', '/other.js');
      registry.set('/parent.js', { id: '/parent.js', exports: {}, loaded: true });

      registry.invalidate('/parent.js');

      expect(registry.getResolution('/parent.js', './child1')).toBeUndefined();
      expect(registry.getResolution('/parent.js', './child2')).toBeUndefined();
      expect(registry.getResolution('/other.js', './other')).toBe('/other.js');
    });

    it('should clean resolutions when target is invalidated', async () => {
      const registry = await createRegistry();

      registry.setResolution('/parent1.js', './target', '/target.js');
      registry.setResolution('/parent2.js', './target', '/target.js');
      registry.set('/target.js', { id: '/target.js', exports: {}, loaded: true });

      registry.invalidate('/target.js');

      expect(registry.getResolution('/parent1.js', './target')).toBeUndefined();
      expect(registry.getResolution('/parent2.js', './target')).toBeUndefined();
    });

    it('should handle bidirectional cleanup correctly', async () => {
      const registry = await createRegistry();

      registry.setResolution('/a.js', './b', '/b.js');
      registry.setResolution('/b.js', './c', '/c.js');
      registry.set('/b.js', { id: '/b.js', exports: {}, loaded: true });

      registry.invalidate('/b.js');

      expect(registry.getResolution('/a.js', './b')).toBeUndefined();
      expect(registry.getResolution('/b.js', './c')).toBeUndefined();
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

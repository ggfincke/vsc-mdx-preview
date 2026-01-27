// tests/webview/ModuleRegistry.test.ts
// Unit tests for ModuleRegistry optimizations (Phase M.1 and M.2)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Dynamic import to get fresh instance for each test
async function createRegistry() {
  vi.resetModules();
  const module = await import(
    '../../packages/webview-app/src/module-system/registry/ModuleRegistry'
  );
  // Create new instance instead of using singleton
  return new module.ModuleRegistry();
}

describe('ModuleRegistry', () => {
  describe('M.1: Dual-map style tracking for O(1) LRU eviction', () => {
    describe('markStyleInjected', () => {
      it('should add new style to referencedStyles with refCount 1', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1');

        expect(registry.hasInjectedStyle('style-1')).toBe(true);
        expect(registry.getStats().styles).toBe(1);
      });

      it('should increment refCount on repeated injection', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1');
        registry.markStyleInjected('style-1');
        registry.markStyleInjected('style-1');

        // Should still be counted as 1 style
        expect(registry.getStats().styles).toBe(1);
        // But refCount is 3 (internal state)
        expect(registry.hasInjectedStyle('style-1')).toBe(true);
      });

      it('should move style from unreferenced to referenced when re-injected', async () => {
        const registry = await createRegistry();

        // Inject and then decrement to make unreferenced
        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');

        // Re-inject should move back to referenced
        registry.markStyleInjected('style-1');

        // Should still exist
        expect(registry.hasInjectedStyle('style-1')).toBe(true);
      });
    });

    describe('decrementStyleRef', () => {
      it('should move style to unreferenced when refCount hits 0', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');

        // Should still exist (now in unreferenced)
        expect(registry.hasInjectedStyle('style-1')).toBe(true);
        expect(registry.getStats().styles).toBe(1);
      });

      it('should handle decrement on already unreferenced style', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');
        registry.decrementStyleRef('style-1'); // Already at 0

        // Should still exist and not throw
        expect(registry.hasInjectedStyle('style-1')).toBe(true);
      });

      it('should handle decrement on non-existent style gracefully', async () => {
        const registry = await createRegistry();

        // Should not throw
        expect(() => registry.decrementStyleRef('non-existent')).not.toThrow();
      });
    });

    describe('eviction behavior', () => {
      it('should evict oldest unreferenced style when at capacity', async () => {
        const registry = await createRegistry();
        registry.configureLRU({ maxStyles: 3 });

        // Fill to capacity with unreferenced styles
        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');
        registry.markStyleInjected('style-2');
        registry.decrementStyleRef('style-2');
        registry.markStyleInjected('style-3');
        registry.decrementStyleRef('style-3');

        // Add one more (should evict style-1 as oldest)
        registry.markStyleInjected('style-4');

        expect(registry.hasInjectedStyle('style-1')).toBe(false); // Evicted
        expect(registry.hasInjectedStyle('style-2')).toBe(true);
        expect(registry.hasInjectedStyle('style-3')).toBe(true);
        expect(registry.hasInjectedStyle('style-4')).toBe(true);
        expect(registry.getStats().styles).toBe(3);
      });

      it('should not evict referenced styles', async () => {
        const registry = await createRegistry();
        registry.configureLRU({ maxStyles: 2 });

        // Add 2 referenced styles (at capacity)
        registry.markStyleInjected('style-1');
        registry.markStyleInjected('style-2');

        // Add a third - should not evict because all are referenced
        registry.markStyleInjected('style-3');

        // All should still exist (capacity exceeded but can't evict)
        expect(registry.hasInjectedStyle('style-1')).toBe(true);
        expect(registry.hasInjectedStyle('style-2')).toBe(true);
        expect(registry.hasInjectedStyle('style-3')).toBe(true);
        expect(registry.getStats().styles).toBe(3);
      });

      it('should evict in LRU order (oldest unreferenced first)', async () => {
        const registry = await createRegistry();
        registry.configureLRU({ maxStyles: 3 });

        // Create 3 unreferenced styles
        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');
        registry.markStyleInjected('style-2');
        registry.decrementStyleRef('style-2');
        registry.markStyleInjected('style-3');
        registry.decrementStyleRef('style-3');

        // Access style-1 again (makes it most recently used in unreferenced)
        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');

        // Add new style - should evict style-2 (now oldest)
        registry.markStyleInjected('style-4');

        expect(registry.hasInjectedStyle('style-1')).toBe(true); // Was accessed recently
        expect(registry.hasInjectedStyle('style-2')).toBe(false); // Evicted (oldest)
        expect(registry.hasInjectedStyle('style-3')).toBe(true);
        expect(registry.hasInjectedStyle('style-4')).toBe(true);
      });

      it('should be O(1) for eviction (performance test)', async () => {
        const registry = await createRegistry();
        registry.configureLRU({ maxStyles: 100 });

        // Fill to capacity with unreferenced styles
        for (let i = 0; i < 100; i++) {
          registry.markStyleInjected(`style-${i}`);
          registry.decrementStyleRef(`style-${i}`);
        }

        // Measure eviction time for 100 more insertions
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          registry.markStyleInjected(`new-style-${i}`);
          registry.decrementStyleRef(`new-style-${i}`);
        }
        const elapsed = performance.now() - start;

        // Should complete quickly (O(1) per eviction vs O(n))
        // Very generous threshold - just ensuring it doesn't take seconds
        expect(elapsed).toBeLessThan(100);
      });
    });

    describe('clearInjectedStyles', () => {
      it('should clear both referenced and unreferenced styles', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1'); // Referenced
        registry.markStyleInjected('style-2');
        registry.decrementStyleRef('style-2'); // Unreferenced

        registry.clearInjectedStyles();

        expect(registry.hasInjectedStyle('style-1')).toBe(false);
        expect(registry.hasInjectedStyle('style-2')).toBe(false);
        expect(registry.getStats().styles).toBe(0);
      });
    });

    describe('unmarkStyleInjected', () => {
      it('should remove from referenced styles', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1');
        registry.unmarkStyleInjected('style-1');

        expect(registry.hasInjectedStyle('style-1')).toBe(false);
      });

      it('should remove from unreferenced styles', async () => {
        const registry = await createRegistry();

        registry.markStyleInjected('style-1');
        registry.decrementStyleRef('style-1');
        registry.unmarkStyleInjected('style-1');

        expect(registry.hasInjectedStyle('style-1')).toBe(false);
      });
    });
  });

  describe('M.2: Resolution map reverse indexes for O(k) cleanup', () => {
    describe('setResolution', () => {
      it('should store resolution and update indexes', async () => {
        const registry = await createRegistry();

        registry.setResolution('/parent.js', './child', '/child.js');

        expect(registry.getResolution('/parent.js', './child')).toBe('/child.js');
      });

      it('should update target index when overwriting resolution', async () => {
        const registry = await createRegistry();

        registry.setResolution('/parent.js', './child', '/child-v1.js');
        registry.setResolution('/parent.js', './child', '/child-v2.js');

        expect(registry.getResolution('/parent.js', './child')).toBe(
          '/child-v2.js'
        );
        expect(registry.getStats().resolutions).toBe(1);
      });

      it('should maintain separate indexes for parent and target', async () => {
        const registry = await createRegistry();

        // Same target from different parents
        registry.setResolution('/parent1.js', './shared', '/shared.js');
        registry.setResolution('/parent2.js', './shared', '/shared.js');

        expect(registry.getResolution('/parent1.js', './shared')).toBe(
          '/shared.js'
        );
        expect(registry.getResolution('/parent2.js', './shared')).toBe(
          '/shared.js'
        );
        expect(registry.getStats().resolutions).toBe(2);
      });
    });

    describe('invalidate (cleanResolutionMapFor)', () => {
      it('should clean resolutions where module is parent', async () => {
        const registry = await createRegistry();

        registry.setResolution('/parent.js', './child1', '/child1.js');
        registry.setResolution('/parent.js', './child2', '/child2.js');
        registry.setResolution('/other.js', './other', '/other.js');

        // Need to add module to cache first for invalidate to work on resolution cleanup
        registry.set('/parent.js', { id: '/parent.js', exports: {}, loaded: true });

        registry.invalidate('/parent.js');

        // Resolutions with /parent.js as parent should be cleaned
        expect(registry.getResolution('/parent.js', './child1')).toBeUndefined();
        expect(registry.getResolution('/parent.js', './child2')).toBeUndefined();
        // Other resolutions should remain
        expect(registry.getResolution('/other.js', './other')).toBe('/other.js');
      });

      it('should clean resolutions where module is target', async () => {
        const registry = await createRegistry();

        registry.setResolution('/parent1.js', './target', '/target.js');
        registry.setResolution('/parent2.js', './target', '/target.js');
        registry.setResolution('/parent3.js', './other', '/other.js');

        // Add module to cache
        registry.set('/target.js', { id: '/target.js', exports: {}, loaded: true });

        registry.invalidate('/target.js');

        // All resolutions pointing to /target.js should be cleaned
        expect(registry.getResolution('/parent1.js', './target')).toBeUndefined();
        expect(registry.getResolution('/parent2.js', './target')).toBeUndefined();
        // Other resolutions should remain
        expect(registry.getResolution('/parent3.js', './other')).toBe('/other.js');
      });

      it('should handle bidirectional cleanup correctly', async () => {
        const registry = await createRegistry();

        // Module A imports B, B imports C
        registry.setResolution('/a.js', './b', '/b.js');
        registry.setResolution('/b.js', './c', '/c.js');

        registry.set('/b.js', { id: '/b.js', exports: {}, loaded: true });

        registry.invalidate('/b.js');

        // /b.js as target should be cleaned
        expect(registry.getResolution('/a.js', './b')).toBeUndefined();
        // /b.js as parent should be cleaned
        expect(registry.getResolution('/b.js', './c')).toBeUndefined();
      });

      it('should be efficient (O(k) instead of O(n))', async () => {
        const registry = await createRegistry();

        // Create many unrelated resolutions
        for (let i = 0; i < 1000; i++) {
          registry.setResolution(`/parent-${i}.js`, './child', `/child-${i}.js`);
        }

        // Add one specific target module
        registry.setResolution('/test-parent.js', './test', '/test-target.js');
        registry.set('/test-target.js', {
          id: '/test-target.js',
          exports: {},
          loaded: true,
        });

        // Measure cleanup time
        const start = performance.now();
        registry.invalidate('/test-target.js');
        const elapsed = performance.now() - start;

        // Should be fast (O(k) where k=1, not O(n) where n=1000)
        expect(elapsed).toBeLessThan(50);

        // Should have only cleaned the one related resolution
        expect(registry.getResolution('/test-parent.js', './test')).toBeUndefined();
        expect(registry.getStats().resolutions).toBe(1000);
      });
    });

    describe('clearResolutions', () => {
      it('should clear resolution map and all indexes', async () => {
        const registry = await createRegistry();

        registry.setResolution('/a.js', './b', '/b.js');
        registry.setResolution('/b.js', './c', '/c.js');

        registry.clearResolutions();

        expect(registry.getResolution('/a.js', './b')).toBeUndefined();
        expect(registry.getResolution('/b.js', './c')).toBeUndefined();
        expect(registry.getStats().resolutions).toBe(0);
      });
    });

    describe('invalidateWithDependents', () => {
      it('should clean resolutions for all invalidated modules', async () => {
        const registry = await createRegistry();

        // Setup dependency: a -> b -> c
        registry.set('/a.js', { id: '/a.js', exports: {}, loaded: true });
        registry.set('/b.js', { id: '/b.js', exports: {}, loaded: true });
        registry.set('/c.js', { id: '/c.js', exports: {}, loaded: true });

        registry.addDependency('/a.js', '/b.js'); // a depends on b
        registry.addDependency('/b.js', '/c.js'); // b depends on c

        registry.setResolution('/a.js', './b', '/b.js');
        registry.setResolution('/b.js', './c', '/c.js');
        registry.setResolution('/other.js', './other', '/other.js');

        // Invalidate c - should cascade to b and a
        const invalidated = registry.invalidateWithDependents('/c.js');

        expect(invalidated.has('/c.js')).toBe(true);
        expect(invalidated.has('/b.js')).toBe(true);
        expect(invalidated.has('/a.js')).toBe(true);

        // All related resolutions should be cleaned
        expect(registry.getResolution('/a.js', './b')).toBeUndefined();
        expect(registry.getResolution('/b.js', './c')).toBeUndefined();
        // Unrelated should remain
        expect(registry.getResolution('/other.js', './other')).toBe('/other.js');
      });
    });
  });

  describe('getStats', () => {
    it('should report correct style count from both maps', async () => {
      const registry = await createRegistry();

      registry.markStyleInjected('style-1'); // Referenced
      registry.markStyleInjected('style-2');
      registry.decrementStyleRef('style-2'); // Unreferenced

      const stats = registry.getStats();
      expect(stats.styles).toBe(2);
    });
  });
});

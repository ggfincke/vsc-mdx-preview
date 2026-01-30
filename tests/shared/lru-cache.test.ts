// tests/shared/lru-cache.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache, ContentHashCache } from '@mdx-preview/shared';

describe('LRUCache', () => {
  describe('basic operations', () => {
    it('should set and get values', () => {
      const cache = new LRUCache<string, string>({ maxEntries: 10 });
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing keys', () => {
      const cache = new LRUCache<string, string>({ maxEntries: 10 });
      expect(cache.get('missing')).toBeNull();
    });

    it('should overwrite existing keys', () => {
      const cache = new LRUCache<string, string>({ maxEntries: 10 });
      cache.set('key', 'value1');
      cache.set('key', 'value2');
      expect(cache.get('key')).toBe('value2');
      expect(cache.size).toBe(1);
    });

    it('should delete keys', () => {
      const cache = new LRUCache<string, string>({ maxEntries: 10 });
      cache.set('key', 'value');
      expect(cache.delete('key')).toBe(true);
      expect(cache.get('key')).toBeNull();
      expect(cache.delete('key')).toBe(false);
    });

    it('should report correct size', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 10 });
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      expect(cache.size).toBe(1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
      cache.delete('a');
      expect(cache.size).toBe(1);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<string, string>({ maxEntries: 10 });
      cache.set('a', '1');
      cache.set('b', '2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeNull();
    });

    it('should check if key exists with has()', () => {
      const cache = new LRUCache<string, string>({ maxEntries: 10 });
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should peek without updating LRU position', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 2 });
      cache.set('a', 1);
      cache.set('b', 2);

      // peek 'a' - should NOT update LRU position
      expect(cache.peek('a')).toBe(1);

      // add 'c' - should evict 'a' (oldest) not 'b'
      cache.set('c', 3);
      expect(cache.peek('a')).toBeUndefined();
      expect(cache.peek('b')).toBe(2);
      expect(cache.peek('c')).toBe(3);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when maxEntries exceeded', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 3 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // evicts 'a'

      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
      expect(cache.size).toBe(3);
    });

    it('should update LRU position on get()', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 3 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // access 'a' - moves it to end of LRU
      cache.get('a');

      cache.set('d', 4); // evicts 'b' (now oldest)

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update LRU position on set() for existing key', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 3 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // update 'a' - moves it to end of LRU
      cache.set('a', 10);

      cache.set('d', 4); // evicts 'b' (now oldest)

      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeNull();
    });

    it('should call onEvict when entry is evicted', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        onEvict,
      });

      cache.set('a', 1);
      cache.set('b', 2);
      expect(onEvict).not.toHaveBeenCalled();

      cache.set('c', 3); // evicts 'a'
      expect(onEvict).toHaveBeenCalledWith('a', 1);
      expect(onEvict).toHaveBeenCalledTimes(1);
    });

    it('should call onEvict when entry is deleted', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({
        maxEntries: 10,
        onEvict,
      });

      cache.set('a', 1);
      cache.delete('a');
      expect(onEvict).toHaveBeenCalledWith('a', 1);
    });

    it('should call onEvict for all entries on clearWithEviction()', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({
        maxEntries: 10,
        onEvict,
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.clearWithEviction();

      expect(onEvict).toHaveBeenCalledTimes(2);
      expect(onEvict).toHaveBeenCalledWith('a', 1);
      expect(onEvict).toHaveBeenCalledWith('b', 2);
    });

    it('should NOT call onEvict on clear()', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({
        maxEntries: 10,
        onEvict,
      });

      cache.set('a', 1);
      cache.clear();
      expect(onEvict).not.toHaveBeenCalled();
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return null for expired entries', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 10,
        ttlMs: 1000,
      });

      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');

      vi.advanceTimersByTime(500);
      expect(cache.get('key')).toBe('value');

      vi.advanceTimersByTime(600); // total 1100ms > 1000ms TTL
      expect(cache.get('key')).toBeNull();
    });

    it('should call onEvict for expired entries on access', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, string>({
        maxEntries: 10,
        ttlMs: 1000,
        onEvict,
      });

      cache.set('key', 'value');
      vi.advanceTimersByTime(1100);

      cache.get('key'); // triggers expiration check
      expect(onEvict).toHaveBeenCalledWith('key', 'value');
    });

    it('should report has() as false for expired entries', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 10,
        ttlMs: 1000,
      });

      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);

      vi.advanceTimersByTime(1100);
      expect(cache.has('key')).toBe(false);
    });

    it('should prune expired entries', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 10,
        ttlMs: 1000,
      });

      cache.set('a', '1');
      cache.set('b', '2');
      vi.advanceTimersByTime(500);
      cache.set('c', '3');
      vi.advanceTimersByTime(600); // a,b expired, c still valid

      const pruned = cache.pruneExpired();
      expect(pruned).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.get('c')).toBe('3');
    });

    it('should reset TTL on update', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 10,
        ttlMs: 1000,
      });

      cache.set('key', 'value1');
      vi.advanceTimersByTime(800);

      cache.set('key', 'value2'); // reset TTL
      vi.advanceTimersByTime(800); // 800ms since update, total 1600ms

      expect(cache.get('key')).toBe('value2'); // still valid
    });
  });

  describe('memory-based eviction', () => {
    it('should evict when memory limit exceeded', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 100,
        maxMemoryBytes: 100,
        estimateSize: (value) => value.length,
      });

      cache.set('a', 'x'.repeat(40)); // 40 bytes
      cache.set('b', 'x'.repeat(40)); // 80 bytes total
      expect(cache.size).toBe(2);

      cache.set('c', 'x'.repeat(40)); // 120 bytes > 100 limit, evicts 'a'
      expect(cache.size).toBe(2);
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).not.toBeNull();
      expect(cache.get('c')).not.toBeNull();
    });

    it('should track memory usage correctly', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 100,
        estimateSize: (value) => value.length,
      });

      cache.set('a', 'hello'); // 5 bytes
      expect(cache.memoryBytes).toBe(5);

      cache.set('b', 'world!'); // 6 bytes
      expect(cache.memoryBytes).toBe(11);

      cache.delete('a');
      expect(cache.memoryBytes).toBe(6);

      cache.clear();
      expect(cache.memoryBytes).toBe(0);
    });

    it('should update memory on key overwrite', () => {
      const cache = new LRUCache<string, string>({
        maxEntries: 100,
        estimateSize: (value) => value.length,
      });

      cache.set('key', 'short'); // 5 bytes
      expect(cache.memoryBytes).toBe(5);

      cache.set('key', 'much longer value'); // 17 bytes
      expect(cache.memoryBytes).toBe(17);
    });
  });

  describe('updateSettings', () => {
    it('should update maxEntries and trigger eviction', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 5 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);
      cache.set('e', 5);

      cache.updateSettings({ maxEntries: 3 });

      expect(cache.size).toBe(3);
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toBe(3);
    });

    it('should update onEvict callback', () => {
      const onEvict1 = vi.fn();
      const onEvict2 = vi.fn();

      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        onEvict: onEvict1,
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // evicts 'a', calls onEvict1

      expect(onEvict1).toHaveBeenCalledWith('a', 1);
      expect(onEvict2).not.toHaveBeenCalled();

      cache.updateSettings({ onEvict: onEvict2 });
      cache.set('d', 4); // evicts 'b', calls onEvict2

      expect(onEvict2).toHaveBeenCalledWith('b', 2);
      expect(onEvict1).toHaveBeenCalledTimes(1);
    });
  });

  describe('iteration', () => {
    it('should iterate keys in LRU order (oldest first)', () => {
      const cache = new LRUCache<string, number>({ maxEntries: 10 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a'); // move 'a' to end

      const keys = Array.from(cache.keys());
      expect(keys).toEqual(['b', 'c', 'a']);
    });

    it('should iterate entries excluding expired', () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string, number>({
        maxEntries: 10,
        ttlMs: 1000,
      });

      cache.set('a', 1);
      vi.advanceTimersByTime(500);
      cache.set('b', 2);
      vi.advanceTimersByTime(600); // 'a' expired

      const entries = Array.from(cache.entries());
      expect(entries).toEqual([['b', 2]]);

      vi.useRealTimers();
    });
  });

  describe('entry protection (isProtected)', () => {
    it('should not evict protected entries when at capacity', () => {
      const protectedKeys = new Set(['p1', 'p2']);
      const cache = new LRUCache<string, number>({
        maxEntries: 1, // only 1 non-protected entry allowed
        isProtected: (key) => protectedKeys.has(key),
      });

      cache.set('p1', 1); // protected
      cache.set('p2', 2); // protected
      cache.set('a', 3); // normal (counts as 1)
      cache.set('b', 4); // should evict 'a', not protected entries

      expect(cache.has('p1')).toBe(true);
      expect(cache.has('p2')).toBe(true);
      expect(cache.has('a')).toBe(false); // evicted
      expect(cache.has('b')).toBe(true);
    });

    it('should not count protected entries against maxEntries', () => {
      const protectedKeys = new Set(['p1']);
      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        isProtected: (key) => protectedKeys.has(key),
      });

      cache.set('p1', 1); // protected, doesn't count
      cache.set('a', 2); // counts as 1
      cache.set('b', 3); // counts as 2

      expect(cache.size).toBe(3); // total entries
      expect(cache.has('p1')).toBe(true);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(true);

      cache.set('c', 4); // should evict 'a' (oldest non-protected)
      expect(cache.has('a')).toBe(false);
      expect(cache.has('p1')).toBe(true);
    });

    it('should not count protected memory against maxMemoryBytes', () => {
      const protectedKeys = new Set(['protected']);
      const cache = new LRUCache<string, string>({
        maxEntries: 100,
        maxMemoryBytes: 100,
        estimateSize: (v) => v.length,
        isProtected: (key) => protectedKeys.has(key),
      });

      cache.set('protected', 'x'.repeat(80)); // 80 bytes, doesn't count
      cache.set('a', 'x'.repeat(50)); // 50 bytes
      cache.set('b', 'x'.repeat(60)); // 60 bytes, would be 110 > 100 without protection

      expect(cache.has('protected')).toBe(true);
      expect(cache.has('a')).toBe(false); // evicted for memory
      expect(cache.has('b')).toBe(true);
    });

    it('should report protectedCount correctly', () => {
      const protectedKeys = new Set(['p1', 'p2']);
      const cache = new LRUCache<string, number>({
        maxEntries: 10,
        isProtected: (key) => protectedKeys.has(key),
      });

      cache.set('p1', 1);
      cache.set('p2', 2);
      cache.set('a', 3);

      expect(cache.protectedCount).toBe(2);
      expect(cache.size).toBe(3);
    });

    it('should call onEvict for evicted non-protected entries', () => {
      const onEvict = vi.fn();
      const protectedKeys = new Set(['protected']);
      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        isProtected: (key) => protectedKeys.has(key),
        onEvict,
      });

      cache.set('protected', 1);
      cache.set('a', 2);
      cache.set('b', 3);
      cache.set('c', 4); // evicts 'a'

      expect(onEvict).toHaveBeenCalledWith('a', 2);
      expect(onEvict).toHaveBeenCalledTimes(1);
    });

    it('should evict oldest non-protected when multiple protected at start', () => {
      const protectedKeys = new Set(['p1', 'p2', 'p3']);
      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        isProtected: (key) => protectedKeys.has(key),
      });

      cache.set('p1', 1); // protected
      cache.set('p2', 2); // protected
      cache.set('p3', 3); // protected
      cache.set('a', 4); // normal
      cache.set('b', 5); // normal
      cache.set('c', 6); // should evict 'a' (first non-protected)

      expect(cache.size).toBe(5);
      expect(cache.has('p1')).toBe(true);
      expect(cache.has('p2')).toBe(true);
      expect(cache.has('p3')).toBe(true);
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
    });

    it('should handle dynamic protection via predicate', () => {
      const protectedKeys = new Set<string>();
      const cache = new LRUCache<string, number>({
        maxEntries: 1, // only 1 non-protected entry allowed
        isProtected: (key) => protectedKeys.has(key),
      });

      cache.set('a', 1);
      cache.set('b', 2); // evicts 'a' (both non-protected, only 1 allowed)

      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true);

      // Now protect 'b' and add more
      protectedKeys.add('b');

      cache.set('c', 3); // 'b' protected, 'c' is the only non-protected

      expect(cache.has('b')).toBe(true); // protected
      expect(cache.has('c')).toBe(true); // only non-protected

      cache.set('d', 4); // should evict 'c' (oldest non-protected)

      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(false);
      expect(cache.has('d')).toBe(true);
    });

    it('should stop eviction if all entries are protected', () => {
      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        isProtected: () => true, // everything is protected
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // cannot evict, cache grows beyond maxEntries

      // All entries should remain (no eviction possible)
      expect(cache.size).toBe(3);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
    });
  });
});

describe('ContentHashCache', () => {
  describe('basic operations', () => {
    it('should store and retrieve with matching hash', () => {
      const cache = new ContentHashCache<string[]>({ maxEntries: 10 });
      cache.setWithHash('/path/file.ts', 'abc123', ['class1', 'class2']);

      const result = cache.getIfHashMatches('/path/file.ts', 'abc123');
      expect(result).toEqual(['class1', 'class2']);
    });

    it('should return null for hash mismatch', () => {
      const cache = new ContentHashCache<string[]>({ maxEntries: 10 });
      cache.setWithHash('/path/file.ts', 'abc123', ['class1', 'class2']);

      const result = cache.getIfHashMatches('/path/file.ts', 'different-hash');
      expect(result).toBeNull();
    });

    it('should return null for missing key', () => {
      const cache = new ContentHashCache<string[]>({ maxEntries: 10 });
      const result = cache.getIfHashMatches('/missing', 'any-hash');
      expect(result).toBeNull();
    });

    it('should check hasValidEntry correctly', () => {
      const cache = new ContentHashCache<string>({ maxEntries: 10 });
      cache.setWithHash('key', 'hash1', 'value');

      expect(cache.hasValidEntry('key', 'hash1')).toBe(true);
      expect(cache.hasValidEntry('key', 'wrong-hash')).toBe(false);
      expect(cache.hasValidEntry('missing', 'any-hash')).toBe(false);
    });

    it('should update value for same key', () => {
      const cache = new ContentHashCache<string>({ maxEntries: 10 });
      cache.setWithHash('key', 'hash1', 'value1');
      cache.setWithHash('key', 'hash2', 'value2');

      expect(cache.getIfHashMatches('key', 'hash1')).toBeNull();
      expect(cache.getIfHashMatches('key', 'hash2')).toBe('value2');
    });
  });

  describe('LRU behavior', () => {
    it('should evict oldest entry', () => {
      const cache = new ContentHashCache<number>({ maxEntries: 2 });
      cache.setWithHash('a', 'h1', 1);
      cache.setWithHash('b', 'h2', 2);
      cache.setWithHash('c', 'h3', 3); // evicts 'a'

      expect(cache.getIfHashMatches('a', 'h1')).toBeNull();
      expect(cache.getIfHashMatches('b', 'h2')).toBe(2);
      expect(cache.getIfHashMatches('c', 'h3')).toBe(3);
    });

    it('should update LRU position on successful get', () => {
      const cache = new ContentHashCache<number>({ maxEntries: 2 });
      cache.setWithHash('a', 'h1', 1);
      cache.setWithHash('b', 'h2', 2);

      // access 'a' with matching hash - moves to end
      cache.getIfHashMatches('a', 'h1');

      cache.setWithHash('c', 'h3', 3); // evicts 'b'

      expect(cache.getIfHashMatches('a', 'h1')).toBe(1);
      expect(cache.getIfHashMatches('b', 'h2')).toBeNull();
    });
  });

  describe('TTL behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      const cache = new ContentHashCache<string>({
        maxEntries: 10,
        ttlMs: 1000,
      });

      cache.setWithHash('key', 'hash', 'value');
      expect(cache.getIfHashMatches('key', 'hash')).toBe('value');

      vi.advanceTimersByTime(1100);
      expect(cache.getIfHashMatches('key', 'hash')).toBeNull();
    });
  });

  describe('utility methods', () => {
    it('should report correct size', () => {
      const cache = new ContentHashCache<number>({ maxEntries: 10 });
      expect(cache.size).toBe(0);

      cache.setWithHash('a', 'h1', 1);
      expect(cache.size).toBe(1);

      cache.setWithHash('b', 'h2', 2);
      expect(cache.size).toBe(2);

      cache.delete('a');
      expect(cache.size).toBe(1);
    });

    it('should clear all entries', () => {
      const cache = new ContentHashCache<number>({ maxEntries: 10 });
      cache.setWithHash('a', 'h1', 1);
      cache.setWithHash('b', 'h2', 2);

      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
});

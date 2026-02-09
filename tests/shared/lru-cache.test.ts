// tests/shared/lru-cache.test.ts
// unit tests for runtime-utils LRU cache behaviors

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  LRUCache,
} from '@mdx-preview/runtime-utils';

describe('LRUCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>({ maxEntries: 5 });
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(2);
  });

  it('evicts least recently used entry when count exceeds maxEntries', () => {
    const cache = new LRUCache<string, number>({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('calls onEvict when entries are evicted or deleted', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string, number>({
      maxEntries: 1,
      onEvict,
    });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('b');

    expect(onEvict).toHaveBeenCalledWith('a', 1);
    expect(onEvict).toHaveBeenCalledWith('b', 2);
  });

  it('expires entries by TTL on get/has and supports pruneExpired', () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string, number>({
      maxEntries: 5,
      ttlMs: 100,
    });
    cache.set('a', 1);
    cache.set('b', 2);

    vi.advanceTimersByTime(101);

    expect(cache.get('a')).toBeNull();
    expect(cache.has('b')).toBe(false);
    expect(cache.pruneExpired()).toBe(0);
    expect(cache.size).toBe(0);
  });

});


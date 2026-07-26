// tests/shared/duplicate-divergence.test.ts
// document intentional GPL/MIT duplicate divergence
// ! cross-repo duplicate: update audit if private-only behavior changes

import { afterEach, describe, expect, it, vi } from 'vitest';
import { LRUCache } from '../../packages/runtime-utils/src/cache/lru-cache';
import {
  isNpmModuleId,
  isValidModuleRequest,
} from '../../packages/runtime-utils/src/module-id';

afterEach(() => {
  vi.useRealTimers();
});

describe('LRU cache private runtime-utils surface', () => {
  it('keeps TTL and eviction helpers outside the shared subset', () => {
    vi.useFakeTimers();
    const ttlEvicted: Array<[string, string]> = [];
    const ttlCache = new LRUCache<string, string>({
      maxEntries: 10,
      ttlMs: 1000,
      onEvict: (key, value) => ttlEvicted.push([key, value]),
    });

    ttlCache.set('ttl-a', 'a');
    ttlCache.set('ttl-b', 'b');
    vi.advanceTimersByTime(1001);
    expect(ttlCache.get('ttl-a')).toBeNull();
    expect(ttlCache.pruneExpired()).toBe(1);
    expect(ttlEvicted).toEqual([
      ['ttl-a', 'a'],
      ['ttl-b', 'b'],
    ]);

    const clearEvicted: Array<[string, number]> = [];
    const clearCache = new LRUCache<string, number>({
      maxEntries: 10,
      onEvict: (key, value) => clearEvicted.push([key, value]),
    });
    clearCache.set('a', 1);
    clearCache.set('b', 2);
    clearCache.clearWithEviction();
    expect(clearCache.size).toBe(0);
    expect(clearEvicted).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('module ID private runtime-utils surface', () => {
  it('keeps npm ID and request validation helpers outside mdx-forge', () => {
    expect(isNpmModuleId('npm://react@18')).toBe(true);
    expect(isNpmModuleId('./local')).toBe(false);

    expect(isValidModuleRequest('react')).toBe(true);
    expect(isValidModuleRequest('node:fs')).toBe(true);
    expect(isValidModuleRequest('npm://react@18')).toBe(true);
    expect(isValidModuleRequest('http://example.com/pkg')).toBe(false);
    expect(isValidModuleRequest('file:///etc/passwd')).toBe(false);
    expect(isValidModuleRequest('data:text/javascript,export default 1')).toBe(
      false
    );
    expect(isValidModuleRequest('bad\0request')).toBe(false);
  });
});

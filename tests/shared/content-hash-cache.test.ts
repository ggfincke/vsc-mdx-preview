// tests/shared/content-hash-cache.test.ts
// unit tests for content-hash validated cache wrapper

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ContentHashCache } from '@mdx-preview/runtime-utils';

describe('ContentHashCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns value when hash matches', () => {
    const cache = new ContentHashCache<string[]>({ maxEntries: 5 });
    cache.setWithHash('/file.ts', 'hash-a', ['a', 'b']);

    expect(cache.getIfHashMatches('/file.ts', 'hash-a')).toEqual(['a', 'b']);
    expect(cache.hasValidEntry('/file.ts', 'hash-a')).toBe(true);
  });

  it('returns null on hash mismatch and preserves entry for matching hash', () => {
    const cache = new ContentHashCache<string[]>({ maxEntries: 5 });
    cache.setWithHash('/file.ts', 'hash-a', ['a']);

    expect(cache.getIfHashMatches('/file.ts', 'hash-b')).toBeNull();
    expect(cache.hasValidEntry('/file.ts', 'hash-a')).toBe(true);
    expect(cache.getIfHashMatches('/file.ts', 'hash-a')).toEqual(['a']);
  });

  it('supports delete and clear operations', () => {
    const cache = new ContentHashCache<string[]>({ maxEntries: 5 });
    cache.setWithHash('/a.ts', 'hash-a', ['a']);
    cache.setWithHash('/b.ts', 'hash-b', ['b']);

    expect(cache.delete('/a.ts')).toBe(true);
    expect(cache.delete('/a.ts')).toBe(false);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('prunes expired entries when ttl is configured', () => {
    vi.useFakeTimers();
    const cache = new ContentHashCache<string[]>({
      maxEntries: 5,
      ttlMs: 100,
    });
    cache.setWithHash('/a.ts', 'hash-a', ['a']);
    cache.setWithHash('/b.ts', 'hash-b', ['b']);

    vi.advanceTimersByTime(101);

    expect(cache.pruneExpired()).toBe(2);
    expect(cache.size).toBe(0);
  });
});

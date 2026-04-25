// tests/shared/utility-parity.test.ts
// verify copied utility behavior across vsc-mdx-preview & mdx-forge
// ! cross-repo parity: mirror mdx-forge/tests/cross-repo/utility-parity.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Semaphore } from '../../packages/runtime-utils/src/async/semaphore';
import { LRUCache } from '../../packages/runtime-utils/src/cache/lru-cache';
import { isBareImport } from '../../packages/runtime-utils/src/module-id';
import { copyToClipboard } from '../../packages/webview-client/src/shared/utils/clipboard';
import { cn } from '../../packages/webview-client/src/shared/utils/cn';

describe('cross-repo utility parity', () => {
  describe('cn() behavioral contract', () => {
    it('joins class names and filters falsy values', () => {
      expect(cn('a', 'b')).toBe('a b');
      expect(cn('a', false, 'b')).toBe('a b');
      expect(cn('a', null, undefined, 'b')).toBe('a b');
      expect(cn()).toBe('');
      expect(cn(false, null, undefined)).toBe('');
      expect(cn('only')).toBe('only');
    });
  });

  describe('copyToClipboard() behavioral contract', () => {
    let originalNavigator: typeof globalThis.navigator;

    beforeEach(() => {
      originalNavigator = globalThis.navigator;
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('returns true for success and false for write failures', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: async () => {} } },
        writable: true,
        configurable: true,
      });
      expect(await copyToClipboard('test')).toBe(true);

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            writeText: async () => {
              throw new Error('denied');
            },
          },
        },
        writable: true,
        configurable: true,
      });
      expect(await copyToClipboard('test')).toBe(false);
    });
  });

  describe('LRUCache shared contract', () => {
    it('tracks access order, eviction, memory, protection and settings', () => {
      const evicted: Array<[string, number]> = [];
      const cache = new LRUCache<string, number>({
        maxEntries: 2,
        onEvict: (key, value) => evicted.push([key, value]),
      });

      cache.set('a', 1);
      cache.set('b', 2);
      expect(Array.from(cache.entries())).toEqual([
        ['a', 1],
        ['b', 2],
      ]);
      expect(cache.get('a')).toBe(1);
      expect(Array.from(cache.keys())).toEqual(['b', 'a']);

      cache.set('c', 3);
      expect(cache.has('b')).toBe(false);
      expect(cache.peek('a')).toBe(1);
      expect(Array.from(cache.keys())).toEqual(['a', 'c']);
      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('missing')).toBe(false);
      cache.clear();
      expect(evicted).toEqual([
        ['b', 2],
        ['a', 1],
      ]);

      const memoryCache = new LRUCache<string, number>({
        maxEntries: 10,
        estimateSize: (value) => value,
        maxMemoryBytes: 5,
      });
      memoryCache.set('a', 2);
      memoryCache.set('b', 2);
      memoryCache.set('c', 2);
      expect(Array.from(memoryCache.keys())).toEqual(['b', 'c']);
      expect(memoryCache.memoryBytes).toBe(4);

      const protectedCache = new LRUCache<string, number>({
        maxEntries: 1,
        isProtected: (key) => key === 'a',
      });
      protectedCache.set('a', 1);
      protectedCache.set('b', 2);
      protectedCache.set('c', 3);
      expect(Array.from(protectedCache.keys())).toEqual(['a', 'c']);

      const settingsCache = new LRUCache<string, number>({ maxEntries: 3 });
      settingsCache.set('x', 1);
      settingsCache.set('y', 2);
      settingsCache.set('z', 3);
      settingsCache.updateSettings({ maxEntries: 1 });
      expect(Array.from(settingsCache.entries())).toEqual([['z', 3]]);
    });
  });

  describe('Semaphore shared contract', () => {
    it('limits concurrency and releases queued waiters in FIFO order', async () => {
      const semaphore = new Semaphore(2);
      expect(semaphore.available).toBe(2);
      expect(semaphore.waiting).toBe(0);

      await semaphore.acquire();
      await semaphore.acquire();
      expect(semaphore.available).toBe(0);

      const order: number[] = [];
      const first = semaphore.acquire().then(() => order.push(1));
      const second = semaphore.acquire().then(() => order.push(2));
      expect(semaphore.waiting).toBe(2);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(order).toEqual([]);

      semaphore.release();
      await first;
      expect(semaphore.waiting).toBe(1);
      expect(semaphore.available).toBe(0);

      semaphore.release();
      await second;
      expect(order).toEqual([1, 2]);
      expect(semaphore.waiting).toBe(0);
      expect(semaphore.available).toBe(0);

      semaphore.release();
      semaphore.release();
      expect(semaphore.available).toBe(2);
    });
  });

  describe('module ID shared contract', () => {
    it('classifies bare imports without treating paths or URLs as bare', () => {
      const cases: Array<[string, boolean]> = [
        ['react', true],
        ['@scope/pkg/subpath', true],
        ['lodash/merge', true],
        ['node:fs', true],
        ['./relative', false],
        ['../parent', false],
        ['.hidden', false],
        ['/absolute', false],
        ['C:\\absolute\\path', false],
        ['npm://react@18', false],
        ['https://example.com/pkg', false],
        ['data:text/javascript,export default 1', false],
      ];

      for (const [specifier, expected] of cases) {
        expect(isBareImport(specifier)).toBe(expected);
      }
    });
  });
});

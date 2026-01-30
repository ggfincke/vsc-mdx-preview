// packages/extension/tailwind/TailwindCache.ts
// LRU cache for compiled Tailwind CSS
//
// Uses the shared LRUCache utility for consistent caching behavior
// w/ TTL-based expiration

import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { LRUCache } from '@mdx-preview/shared';
import { CACHE_DEFAULT_MAX_ENTRIES, CACHE_DEFAULT_TTL_MS } from './constants';

export interface TailwindCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

// LRU cache for compiled Tailwind CSS w/ TTL-based expiration
export class TailwindCache {
  private cache: LRUCache<string, string>;

  constructor(options: TailwindCacheOptions = {}) {
    this.cache = new LRUCache<string, string>({
      maxEntries: options.maxEntries ?? CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: options.ttlMs ?? CACHE_DEFAULT_TTL_MS,
    });
  }

  get(key: string): string | null {
    return this.cache.get(key);
  }

  set(key: string, css: string): void {
    this.cache.set(key, css);
  }

  clear(): void {
    this.cache.clear();
    debug(`[${LogTags.TAILWIND}] Cache cleared`);
  }

  updateSettings(options: TailwindCacheOptions): void {
    const hasChanges =
      options.maxEntries !== undefined || options.ttlMs !== undefined;

    if (hasChanges) {
      this.cache.updateSettings({
        maxEntries: options.maxEntries,
        ttlMs: options.ttlMs,
      });
      debug(
        `[TAILWIND] Cache settings updated: maxEntries=${options.maxEntries}, ttlMs=${options.ttlMs}`
      );
    }
  }

  // number of entries in the cache
  get size(): number {
    return this.cache.size;
  }
}

// packages/extension/tailwind/TailwindCache.ts
// LRU cache for compiled Tailwind CSS
//
// error handling strategy:
// - no error handling needed - all operations are synchronous in-memory
// - Map operations cannot fail under normal conditions
// - Defensive coding handles edge cases (e.g., undefined key during eviction)

import { debug } from '../logging';
import { CACHE_DEFAULT_MAX_ENTRIES, CACHE_DEFAULT_TTL_MS } from './constants';

interface CacheEntry {
  css: string;
  expiresAt: number;
}

export interface TailwindCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

// * LRU cache for compiled Tailwind CSS w/ TTL-based expiration
export class TailwindCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(options: TailwindCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? CACHE_DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? CACHE_DEFAULT_TTL_MS;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // refresh LRU position
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.css;
  }

  set(key: string, css: string): void {
    this.cache.delete(key);
    this.cache.set(key, {
      css,
      expiresAt: Date.now() + this.ttlMs,
    });

    this.evictOverflow();
  }

  clear(): void {
    this.cache.clear();
    debug('[TAILWIND] Cache cleared');
  }

  updateSettings(options: TailwindCacheOptions): void {
    const newMaxEntries = options.maxEntries ?? this.maxEntries;
    const newTtlMs = options.ttlMs ?? this.ttlMs;

    if (newMaxEntries !== this.maxEntries || newTtlMs !== this.ttlMs) {
      this.maxEntries = newMaxEntries;
      this.ttlMs = newTtlMs;
      this.evictOverflow();
      debug(
        `[TAILWIND] Cache settings updated: maxEntries=${this.maxEntries}, ttlMs=${this.ttlMs}`
      );
    }
  }

  private evictOverflow(): void {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }
}

// packages/extension-host/src/shared/utils/cache/AsyncLruCache.ts
// bounded result cache w/ in-flight promise deduplication

import { LRUCache } from '@mdx-preview/runtime-utils';

export interface AsyncLruCacheOptions {
  maxEntries: number;
  ttlMs?: number;
}

export class AsyncLruCache<K, V> {
  private readonly cache: LRUCache<K, V>;
  private readonly inFlight = new Map<K, Promise<V | undefined>>();
  private generation = 0;

  constructor(options: AsyncLruCacheOptions) {
    this.cache = new LRUCache<K, V>(options);
  }

  getOrCreate(
    key: K,
    create: () => Promise<V | undefined>
  ): Promise<V | undefined> {
    const cached = this.cache.get(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const generation = this.generation;
    const pending: Promise<V | undefined> = create()
      .then((value) => {
        if (value !== undefined && generation === this.generation) {
          this.cache.set(key, value);
        }
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === pending) {
          this.inFlight.delete(key);
        }
      });
    this.inFlight.set(key, pending);
    return pending;
  }

  clear(): void {
    this.generation += 1;
    this.cache.clear();
    this.inFlight.clear();
  }
}

// packages/runtime-utils/src/cache/content-hash-cache.ts
// LRU cache w/ content hash validation - extends LRUCache to validate entries
// by content hash before returning; useful for caching computed results based
// on file content where the file may have changed since caching

import { LRUCache, type LRUCacheOptions } from './lru-cache';

// cache entry w/ content hash for validation
interface HashValidatedEntry<V> {
  hash: string;
  value: V;
}

// configuration options for ContentHashCache
export interface ContentHashCacheOptions<V> extends Omit<
  LRUCacheOptions<string, HashValidatedEntry<V>>,
  'estimateSize' | 'isProtected'
> {
  // size estimator
  estimateSize?: (value: V) => number;
}

// LRU cache that validates entries by content hash before returning
// example
// ```typescript
// const cache = new ContentHashCache<string[]>({ maxEntries: 50, ttlMs: 300000 });
//
// store w/ content hash
// cache.setWithHash('/path/to/file', contentHash, ['class1', 'class2']);
//
// retrieve only if hash matches current content
// const classes = cache.getIfHashMatches('/path/to/file', currentHash);
// return null if file has changed (hash mismatch)
// ```
export class ContentHashCache<V> {
  private cache: LRUCache<string, HashValidatedEntry<V>>;

  constructor(options: ContentHashCacheOptions<V>) {
    // wrap estimateSize to work w/ entry wrapper
    const wrappedEstimateSize = options.estimateSize
      ? (entry: HashValidatedEntry<V>) =>
          // hash string (~32 bytes) + value size
          options.estimateSize!(entry.value) + 64
      : undefined;

    this.cache = new LRUCache<string, HashValidatedEntry<V>>({
      ...options,
      estimateSize: wrappedEstimateSize,
    });
  }

  // get value if hash matches
  getIfHashMatches(key: string, contentHash: string): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // hash mismatch means content has changed
    if (entry.hash !== contentHash) {
      // don't delete - let LRU eviction handle it
      // the entry might still be valid for other purposes
      return null;
    }

    return entry.value;
  }

  // check if a value exists & hash matches (w/o updating LRU position)
  hasValidEntry(key: string, contentHash: string): boolean {
    const entry = this.cache.peek(key);
    return entry !== undefined && entry.hash === contentHash;
  }

  // set a value w/ its content hash
  setWithHash(key: string, contentHash: string, value: V): void {
    this.cache.set(key, { hash: contentHash, value });
  }

  // delete an entry
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // clear all entries
  clear(): void {
    this.cache.clear();
  }

  // clear all entries & call onEvict for each
  clearWithEviction(): void {
    this.cache.clearWithEviction();
  }

  // entry count
  get size(): number {
    return this.cache.size;
  }

  // current memory usage in bytes
  get memoryBytes(): number {
    return this.cache.memoryBytes;
  }

  // update cache settings dynamically
  updateSettings(options: Partial<ContentHashCacheOptions<V>>): void {
    // note: estimateSize updates not supported after construction
    // due to wrapper complexity
    this.cache.updateSettings({
      maxEntries: options.maxEntries,
      ttlMs: options.ttlMs,
      maxMemoryBytes: options.maxMemoryBytes,
    });
  }

  // remove expired entries proactively
  pruneExpired(): number {
    return this.cache.pruneExpired();
  }
}

// packages/shared/utils/content-hash-cache.ts
// LRU cache w/ content hash validation
//
// extend LRUCache to validate entries by content hash before returning
// useful for caching computed results based on file content where the
// file may have changed since caching

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
  // function to estimate size of a value in bytes (optional)
  estimateSize?: (value: V) => number;
}

// LRU cache that validates entries by content hash before returning
// example:
// ```typescript
// const cache = new ContentHashCache<string[]>({ maxEntries: 50, ttlMs: 300000 });
//
// // Store w/ content hash
// cache.setWithHash('/path/to/file', contentHash, ['class1', 'class2']);
//
// // Retrieve only if hash matches current content
// const classes = cache.getIfHashMatches('/path/to/file', currentHash);
// // Returns null if file has changed (hash mismatch)
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

  // get a value only if the content hash matches
  // returns null if not found, expired, or hash mismatch
  getIfHashMatches(key: string, contentHash: string): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Hash mismatch - content has changed
    if (entry.hash !== contentHash) {
      // Don't delete - let LRU eviction handle it
      // The entry might still be valid for other purposes
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

  // number of entries in the cache
  get size(): number {
    return this.cache.size;
  }

  // current memory usage in bytes
  get memoryBytes(): number {
    return this.cache.memoryBytes;
  }

  // update cache settings dynamically
  updateSettings(options: Partial<ContentHashCacheOptions<V>>): void {
    // Note: estimateSize updates not supported after construction
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

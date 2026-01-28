// packages/extension/utils/cache/LRUCache.ts
// generic LRU cache w/ optional TTL & memory-based eviction
//
// Uses Map insertion order for O(1) LRU tracking:
// - oldest entries are at the start of the Map
// - accessing an entry moves it to the end (delete + re-insert)
// - eviction removes from the start

// configuration options for LRUCache
export interface LRUCacheOptions<K, V> {
  // maximum number of entries before eviction (required)
  maxEntries: number;
  // time-to-live in milliseconds (optional, no expiration if not set)
  ttlMs?: number;
  // callback when entry is evicted (optional)
  onEvict?: (key: K, value: V) => void;
  // function to estimate size of a value in bytes (optional)
  estimateSize?: (value: V) => number;
  // maximum memory in bytes before eviction (optional, requires estimateSize)
  maxMemoryBytes?: number;
}

// internal cache entry w/ metadata
interface CacheEntry<V> {
  value: V;
  expiresAt: number | null; // null = no expiration
  size: number; // 0 if no size estimation
}

// generic LRU cache w/ optional TTL & memory-based eviction
// example:
// ```typescript
// const cache = new LRUCache<string, string>({ maxEntries: 100, ttlMs: 60000 });
// cache.set('key', 'value');
// const value = cache.get('key'); // 'value' or null if expired/evicted
// ```
export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private _maxEntries: number;
  private _ttlMs: number | undefined;
  private _onEvict: ((key: K, value: V) => void) | undefined;
  private _estimateSize: ((value: V) => number) | undefined;
  private _maxMemoryBytes: number | undefined;
  private _currentMemoryBytes = 0;

  constructor(options: LRUCacheOptions<K, V>) {
    this._maxEntries = options.maxEntries;
    this._ttlMs = options.ttlMs;
    this._onEvict = options.onEvict;
    this._estimateSize = options.estimateSize;
    this._maxMemoryBytes = options.maxMemoryBytes;
  }

  // get a value from the cache
  // returns null if not found or expired
  // updates LRU position on access
  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check TTL expiration
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.deleteEntry(key, entry);
      return null;
    }

    // Update LRU position (move to end)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  // get entry w/o updating LRU position (for inspection)
  // returns undefined if not found, entry if found (may be expired)
  peek(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check TTL expiration
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.deleteEntry(key, entry);
      return undefined;
    }

    return entry.value;
  }

  // set a value in the cache
  // evicts old entries if necessary
  set(key: K, value: V): void {
    // Remove existing entry if present
    const existing = this.cache.get(key);
    if (existing) {
      this._currentMemoryBytes -= existing.size;
      this.cache.delete(key);
    }

    // Calculate size and expiration
    const size = this._estimateSize ? this._estimateSize(value) : 0;
    const expiresAt = this._ttlMs ? Date.now() + this._ttlMs : null;

    // Add new entry
    const entry: CacheEntry<V> = { value, expiresAt, size };
    this.cache.set(key, entry);
    this._currentMemoryBytes += size;

    // Evict if over limits
    this.evictOverflow();
  }

  // check if a key exists in the cache (does not update LRU position)
  // returns false if expired
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check TTL expiration
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.deleteEntry(key, entry);
      return false;
    }

    return true;
  }

  // delete a key from the cache
  // returns true if the key existed
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    this.deleteEntry(key, entry);
    return true;
  }

  // clear all entries from the cache
  // does NOT call onEvict for each entry
  clear(): void {
    this.cache.clear();
    this._currentMemoryBytes = 0;
  }

  // clear all entries & call onEvict for each
  clearWithEviction(): void {
    if (this._onEvict) {
      for (const [key, entry] of this.cache) {
        this._onEvict(key, entry.value);
      }
    }
    this.cache.clear();
    this._currentMemoryBytes = 0;
  }

  // number of entries in the cache
  get size(): number {
    return this.cache.size;
  }

  // current memory usage in bytes (if estimateSize is configured)
  get memoryBytes(): number {
    return this._currentMemoryBytes;
  }

  // get all keys in the cache (oldest first)
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  // get all entries in the cache (oldest first)
  *entries(): IterableIterator<[K, V]> {
    for (const [key, entry] of this.cache) {
      // Skip expired entries
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        continue;
      }
      yield [key, entry.value] as [K, V];
    }
  }

  // update cache settings dynamically
  // triggers eviction if new limits are lower
  updateSettings(options: Partial<LRUCacheOptions<K, V>>): void {
    if (options.maxEntries !== undefined) {
      this._maxEntries = options.maxEntries;
    }
    if (options.ttlMs !== undefined) {
      this._ttlMs = options.ttlMs;
    }
    if (options.onEvict !== undefined) {
      this._onEvict = options.onEvict;
    }
    if (options.estimateSize !== undefined) {
      this._estimateSize = options.estimateSize;
    }
    if (options.maxMemoryBytes !== undefined) {
      this._maxMemoryBytes = options.maxMemoryBytes;
    }

    // Evict if now over limits
    this.evictOverflow();
  }

  // remove expired entries proactively
  // call periodically to prevent stale entries from consuming memory
  pruneExpired(): number {
    if (!this._ttlMs) {
      return 0;
    }

    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== null && entry.expiresAt < now) {
        this.deleteEntry(key, entry);
        pruned++;
      }
    }

    return pruned;
  }

  // delete an entry & update memory tracking
  // calls onEvict if configured
  private deleteEntry(key: K, entry: CacheEntry<V>): void {
    this.cache.delete(key);
    this._currentMemoryBytes -= entry.size;
    if (this._onEvict) {
      this._onEvict(key, entry.value);
    }
  }

  // evict oldest entries until under limits
  private evictOverflow(): void {
    // Evict by count
    while (this.cache.size > this._maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.deleteEntry(oldestKey, entry);
      }
    }

    // Evict by memory (if configured)
    if (this._maxMemoryBytes && this._estimateSize) {
      while (
        this._currentMemoryBytes > this._maxMemoryBytes &&
        this.cache.size > 0
      ) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        const entry = this.cache.get(oldestKey);
        if (entry) {
          this.deleteEntry(oldestKey, entry);
        }
      }
    }
  }
}

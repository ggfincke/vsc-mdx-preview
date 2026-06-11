// packages/runtime-utils/src/cache/lru-cache.ts
// GPL runtime LRU cache; shared subset mirrors mdx-forge browser LRU
// ! cross-repo duplicate: keep common behavior covered by parity tests

export interface LRUCacheOptions<K, V> {
  maxEntries: number;
  ttlMs?: number;
  onEvict?: (key: K, value: V) => void;
  estimateSize?: (value: V) => number;
  maxMemoryBytes?: number;
  isProtected?: (key: K, value: V) => boolean;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number | null;
  size: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private _maxEntries: number;
  private _ttlMs: number | undefined;
  private _onEvict: ((key: K, value: V) => void) | undefined;
  private _estimateSize: ((value: V) => number) | undefined;
  private _maxMemoryBytes: number | undefined;
  private _isProtected: ((key: K, value: V) => boolean) | undefined;
  private _currentMemoryBytes = 0;

  constructor(options: LRUCacheOptions<K, V>) {
    this._maxEntries = options.maxEntries;
    this._ttlMs = options.ttlMs;
    this._onEvict = options.onEvict;
    this._estimateSize = options.estimateSize;
    this._maxMemoryBytes = options.maxMemoryBytes;
    this._isProtected = options.isProtected;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.deleteEntry(key, entry);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  peek(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.deleteEntry(key, entry);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    const existing = this.cache.get(key);
    if (existing) {
      this._currentMemoryBytes -= existing.size;
      this.cache.delete(key);
    }

    const size = this._estimateSize ? this._estimateSize(value) : 0;
    const expiresAt = this._ttlMs ? Date.now() + this._ttlMs : null;

    const entry: CacheEntry<V> = { value, expiresAt, size };
    this.cache.set(key, entry);
    this._currentMemoryBytes += size;

    this.evictOverflow();
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.deleteEntry(key, entry);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    this.deleteEntry(key, entry);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this._currentMemoryBytes = 0;
  }

  clearWithEviction(): void {
    if (this._onEvict) {
      for (const [key, entry] of this.cache) {
        this._onEvict(key, entry.value);
      }
    }
    this.cache.clear();
    this._currentMemoryBytes = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get memoryBytes(): number {
    return this._currentMemoryBytes;
  }

  get protectedCount(): number {
    if (!this._isProtected) {
      return 0;
    }
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (this._isProtected(key, entry.value)) {
        count++;
      }
    }
    return count;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  *entries(): IterableIterator<[K, V]> {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        continue;
      }
      yield [key, entry.value] as [K, V];
    }
  }

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
    if (options.isProtected !== undefined) {
      this._isProtected = options.isProtected;
    }

    this.evictOverflow();
  }

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

  private deleteEntry(key: K, entry: CacheEntry<V>): void {
    this.cache.delete(key);
    this._currentMemoryBytes -= entry.size;
    if (this._onEvict) {
      this._onEvict(key, entry.value);
    }
  }

  private countEvictable(): number {
    if (!this._isProtected) {
      return this.cache.size;
    }
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (!this._isProtected(key, entry.value)) {
        count++;
      }
    }
    return count;
  }

  private getEvictableMemory(): number {
    if (!this._isProtected) {
      return this._currentMemoryBytes;
    }
    let memory = 0;
    for (const [key, entry] of this.cache) {
      if (!this._isProtected(key, entry.value)) {
        memory += entry.size;
      }
    }
    return memory;
  }

  private evictOldestEvictable(): boolean {
    for (const [key, entry] of this.cache) {
      if (!this._isProtected || !this._isProtected(key, entry.value)) {
        this.deleteEntry(key, entry);
        return true;
      }
    }
    return false;
  }

  private evictOverflow(): void {
    // countEvictable <= size, so skip O(n) scan when under entry cap
    if (this.cache.size > this._maxEntries) {
      while (this.countEvictable() > this._maxEntries) {
        if (!this.evictOldestEvictable()) {
          break;
        }
      }
    }

    // evictable memory <= total, so skip O(n) scan when under memory cap
    if (
      this._maxMemoryBytes &&
      this._estimateSize &&
      this._currentMemoryBytes > this._maxMemoryBytes
    ) {
      while (
        this.getEvictableMemory() > this._maxMemoryBytes &&
        this.countEvictable() > 0
      ) {
        if (!this.evictOldestEvictable()) {
          break;
        }
      }
    }
  }
}

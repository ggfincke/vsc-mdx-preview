export interface LRUCacheOptions<K, V> {
  maxEntries: number;
  onEvict?: (key: K, value: V) => void;
  estimateSize?: (value: V) => number;
  maxMemoryBytes?: number;
  isProtected?: (key: K, value: V) => boolean;
}

interface CacheEntry<V> {
  value: V;
  size: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxEntries: number;
  private onEvict?: (key: K, value: V) => void;
  private estimateSize?: (value: V) => number;
  private maxMemoryBytes?: number;
  private isProtected?: (key: K, value: V) => boolean;
  private currentMemoryBytes = 0;

  constructor(options: LRUCacheOptions<K, V>) {
    this.maxEntries = options.maxEntries;
    this.onEvict = options.onEvict;
    this.estimateSize = options.estimateSize;
    this.maxMemoryBytes = options.maxMemoryBytes;
    this.isProtected = options.isProtected;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  peek(key: K): V | undefined {
    return this.cache.get(key)?.value;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  set(key: K, value: V): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.currentMemoryBytes -= existing.size;
      this.cache.delete(key);
    }

    const size = this.estimateSize ? this.estimateSize(value) : 0;
    this.cache.set(key, { value, size });
    this.currentMemoryBytes += size;

    this.evictOverflow();
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
    this.currentMemoryBytes = 0;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  *entries(): IterableIterator<[K, V]> {
    for (const [key, entry] of this.cache) {
      yield [key, entry.value];
    }
  }

  updateSettings(options: Partial<LRUCacheOptions<K, V>>): void {
    if (options.maxEntries !== undefined) {
      this.maxEntries = options.maxEntries;
    }
    if (options.onEvict !== undefined) {
      this.onEvict = options.onEvict;
    }
    if (options.estimateSize !== undefined) {
      this.estimateSize = options.estimateSize;
    }
    if (options.maxMemoryBytes !== undefined) {
      this.maxMemoryBytes = options.maxMemoryBytes;
    }
    if (options.isProtected !== undefined) {
      this.isProtected = options.isProtected;
    }

    this.evictOverflow();
  }

  get size(): number {
    return this.cache.size;
  }

  get memoryBytes(): number {
    return this.currentMemoryBytes;
  }

  private deleteEntry(key: K, entry: CacheEntry<V>): void {
    this.cache.delete(key);
    this.currentMemoryBytes -= entry.size;
    this.onEvict?.(key, entry.value);
  }

  private evictOldestEvictable(): boolean {
    for (const [key, entry] of this.cache) {
      if (!this.isProtected || !this.isProtected(key, entry.value)) {
        this.deleteEntry(key, entry);
        return true;
      }
    }
    return false;
  }

  private countEvictable(): number {
    if (!this.isProtected) {
      return this.cache.size;
    }
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (!this.isProtected(key, entry.value)) {
        count++;
      }
    }
    return count;
  }

  private getEvictableMemory(): number {
    if (!this.isProtected) {
      return this.currentMemoryBytes;
    }
    let memory = 0;
    for (const [key, entry] of this.cache) {
      if (!this.isProtected(key, entry.value)) {
        memory += entry.size;
      }
    }
    return memory;
  }

  private evictOverflow(): void {
    while (this.countEvictable() > this.maxEntries) {
      if (!this.evictOldestEvictable()) {
        break;
      }
    }

    if (this.maxMemoryBytes && this.estimateSize) {
      while (
        this.getEvictableMemory() > this.maxMemoryBytes &&
        this.countEvictable() > 0
      ) {
        if (!this.evictOldestEvictable()) {
          break;
        }
      }
    }
  }
}

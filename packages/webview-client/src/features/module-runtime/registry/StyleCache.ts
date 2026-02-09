// packages/webview-app/src/module-system/registry/StyleCache.ts
// style tracking w/ reference counting using shared LRUCache

import { LRUCache } from '@mdx-preview/shared';

const DEFAULT_MAX_STYLES = 100;

// style entry w/ reference count for protection
interface StyleEntry {
  refCount: number;
}

// style cache configuration options
export interface StyleCacheConfig {
  maxStyles?: number;
}

// track injected CSS styles w/ reference counting for proper cleanup
// use LRUCache w/ isProtected predicate
// - protect styles w/ refCount > 0 from eviction
// - evict styles w/ refCount === 0 in lru order
export class StyleCache {
  private cache: LRUCache<string, StyleEntry>;
  private maxStyles = DEFAULT_MAX_STYLES;

  constructor() {
    this.cache = this.createCache();
  }

  // create lru cache w/ protection predicate
  private createCache(): LRUCache<string, StyleEntry> {
    return new LRUCache<string, StyleEntry>({
      maxEntries: this.maxStyles,
      // protect styles w/ active references from eviction
      isProtected: (_key, entry) => entry.refCount > 0,
    });
  }

  // configure maximum number of styles to track
  configure(options: StyleCacheConfig): void {
    if (options.maxStyles !== undefined) {
      this.maxStyles = options.maxStyles;
      this.cache.updateSettings({ maxEntries: options.maxStyles });
    }
  }

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.cache.has(id);
  }

  // get total number of tracked styles
  get size(): number {
    return this.cache.size;
  }

  // mark CSS as injected for module (w/ reference counting)
  // protected styles (refCount > 0) won't be evicted
  markStyleInjected(id: string): void {
    const existing = this.cache.get(id);

    if (existing) {
      existing.refCount++;
      // re-set to update lru position (get already did this, but explicit for clarity)
      this.cache.set(id, existing);
    } else {
      // proactively evict unreferenced styles to make room for new entry
      // maintain compatibility w/ original dual-map behavior where
      // eviction happened BEFORE adding (not after like standard LRUCache)
      this.evictUnreferencedToCapacity();
      // new style starts w/ refCount = 1 (protected)
      this.cache.set(id, { refCount: 1 });
    }
  }

  // evict unreferenced styles until total size is under maxStyles
  // called before adding new entries to maintain capacity
  private evictUnreferencedToCapacity(): void {
    while (this.cache.size >= this.maxStyles) {
      let evicted = false;
      // find oldest unreferenced entry (refCount === 0)
      for (const [key] of this.cache.entries()) {
        const entry = this.cache.peek(key);
        if (entry && entry.refCount === 0) {
          this.cache.delete(key);
          evicted = true;
          break;
        }
      }
      // if no unreferenced entries to evict, stop
      if (!evicted) {
        break;
      }
    }
  }

  // decrement style reference count
  // when refCount hits 0, style becomes eviction candidate
  decrementStyleRef(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      // re-set to ensure cache sees updated refCount for isProtected check
      this.cache.set(id, entry);
    }
  }

  // remove style tracking for a single module (for incremental updates)
  unmarkStyleInjected(id: string): void {
    this.cache.delete(id);
  }

  // clear all style tracking
  clear(): void {
    this.cache.clear();
  }
}

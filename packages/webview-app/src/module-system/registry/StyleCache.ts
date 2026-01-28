// packages/webview-app/src/module-system/registry/StyleCache.ts
// style tracking w/ reference counting & dual-map LRU eviction

const DEFAULT_MAX_STYLES = 100;

// Style tracking w/ reference counting
interface StyleEntry {
  refCount: number;
  lastAccessed: number;
}

// style cache configuration options
export interface StyleCacheConfig {
  maxStyles?: number;
}

// tracks injected CSS styles w/ reference counting for proper cleanup
// uses dual-map architecture for O(1) LRU eviction:
// - referencedStyles: styles w/ refCount > 0 (not evictable)
// - unreferencedStyles: styles w/ refCount === 0 (eviction candidates, LRU order)
export class StyleCache {
  private referencedStyles: Map<string, StyleEntry> = new Map();
  private unreferencedStyles: Map<string, StyleEntry> = new Map();
  private maxStyles = DEFAULT_MAX_STYLES;

  // configure maximum number of styles to track
  configure(options: StyleCacheConfig): void {
    if (options.maxStyles !== undefined) {
      this.maxStyles = options.maxStyles;
    }
  }

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.referencedStyles.has(id) || this.unreferencedStyles.has(id);
  }

  // get total number of tracked styles
  get size(): number {
    return this.referencedStyles.size + this.unreferencedStyles.size;
  }

  // mark CSS as injected for module (w/ reference counting)
  // use dual-map architecture for O(1) LRU eviction
  markStyleInjected(id: string): void {
    // Check both maps for existing entry
    const existingReferenced = this.referencedStyles.get(id);
    const existingUnreferenced = this.unreferencedStyles.get(id);
    const existing = existingReferenced ?? existingUnreferenced;

    if (existing) {
      existing.refCount++;
      existing.lastAccessed = Date.now();
      // If was in unreferenced, move to referenced
      if (existingUnreferenced) {
        this.unreferencedStyles.delete(id);
        this.referencedStyles.set(id, existing);
      }
    } else {
      // Evict if at capacity (only unreferenced can be evicted)
      while (
        this.referencedStyles.size + this.unreferencedStyles.size >= this.maxStyles &&
        this.unreferencedStyles.size > 0
      ) {
        if (!this.evictLRU()) {
          break;
        }
      }
      // New style starts in referenced map
      this.referencedStyles.set(id, { refCount: 1, lastAccessed: Date.now() });
    }
  }

  // decrement style reference count
  // move style to unreferenced map when refCount hits 0 (for O(1) LRU eviction)
  decrementStyleRef(id: string): void {
    const entry = this.referencedStyles.get(id);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      if (entry.refCount === 0) {
        // Move to unreferenced (at end = newest for LRU)
        this.referencedStyles.delete(id);
        this.unreferencedStyles.set(id, entry);
      }
    }
    // If already in unreferencedStyles, just update (already unreferenced)
    const unreferenced = this.unreferencedStyles.get(id);
    if (unreferenced && !entry) {
      unreferenced.refCount = Math.max(0, unreferenced.refCount - 1);
    }
  }

  // evict oldest unreferenced style - O(1) via Map insertion order
  // first entry in unreferencedStyles is the LRU candidate
  private evictLRU(): boolean {
    const firstKey = this.unreferencedStyles.keys().next();
    if (!firstKey.done) {
      this.unreferencedStyles.delete(firstKey.value);
      return true;
    }
    return false;
  }

  // remove style tracking for a single module (for incremental updates)
  unmarkStyleInjected(id: string): void {
    this.referencedStyles.delete(id);
    this.unreferencedStyles.delete(id);
  }

  // clear all style tracking
  clear(): void {
    this.referencedStyles.clear();
    this.unreferencedStyles.clear();
  }
}

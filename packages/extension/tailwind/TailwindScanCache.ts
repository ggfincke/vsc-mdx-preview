// packages/extension/tailwind/TailwindScanCache.ts
// LRU cache for per-file Tailwind class scan results
//
// caches extracted Tailwind classes per file with content hash validation
// to avoid re-scanning unchanged files during preview refresh

import * as crypto from 'crypto';
import { debug } from '../logging';
import {
  SCAN_CACHE_DEFAULT_MAX_ENTRIES,
  CACHE_DEFAULT_TTL_MS,
} from './constants';

interface FileScanEntry {
  contentHash: string;
  classes: string[];
  expiresAt: number;
}

export interface TailwindScanCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

/**
 * Compute SHA-1 hash of content for cache key validation.
 * Using SHA-1 for consistency with TailwindProcessor.buildCacheKey().
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

// * LRU cache for per-file Tailwind class scan results w/ TTL-based expiration
export class TailwindScanCache {
  private cache = new Map<string, FileScanEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(options: TailwindScanCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? SCAN_CACHE_DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? CACHE_DEFAULT_TTL_MS;
  }

  /**
   * Get cached scan result if content hash matches and not expired.
   * Returns null if cache miss, expired, or hash mismatch.
   */
  get(fsPath: string, contentHash: string): string[] | null {
    const entry = this.cache.get(fsPath);
    if (!entry) {
      return null;
    }

    // check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(fsPath);
      return null;
    }

    // check content hash - file may have changed
    if (entry.contentHash !== contentHash) {
      this.cache.delete(fsPath);
      return null;
    }

    // refresh LRU position (delete and re-insert)
    this.cache.delete(fsPath);
    this.cache.set(fsPath, entry);

    debug(`[TAILWIND-SCAN] Cache hit for ${fsPath}`);
    return entry.classes;
  }

  /**
   * Store scan result for a file with its content hash.
   */
  set(fsPath: string, contentHash: string, classes: string[]): void {
    // delete first to ensure it's added at end (LRU position)
    this.cache.delete(fsPath);
    this.cache.set(fsPath, {
      contentHash,
      classes,
      expiresAt: Date.now() + this.ttlMs,
    });

    this.evictOverflow();
  }

  /**
   * Invalidate cached scan result for a specific file.
   * Call when file is known to have changed (e.g., from DependencyWatcher).
   */
  invalidate(fsPath: string): void {
    if (this.cache.delete(fsPath)) {
      debug(`[TAILWIND-SCAN] Invalidated cache for ${fsPath}`);
    }
  }

  /**
   * Clear all cached scan results.
   */
  clear(): void {
    this.cache.clear();
    debug('[TAILWIND-SCAN] Cache cleared');
  }

  /**
   * Get current cache size (for debugging/testing).
   */
  get size(): number {
    return this.cache.size;
  }

  private evictOverflow(): void {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      debug(`[TAILWIND-SCAN] LRU evicting ${oldestKey}`);
      this.cache.delete(oldestKey);
    }
  }
}

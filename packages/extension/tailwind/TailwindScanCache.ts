// packages/extension/tailwind/TailwindScanCache.ts
// LRU cache for per-file Tailwind class scan results w/ hash validation & TTL expiration

import * as crypto from 'crypto';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import { ContentHashCache } from '@mdx-preview/shared';
import {
  SCAN_CACHE_DEFAULT_MAX_ENTRIES,
  CACHE_DEFAULT_TTL_MS,
} from './constants';

export interface TailwindScanCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

// compute SHA-1 hash of content for cache key validation
// using SHA-1 for consistency w/ TailwindProcessor.buildCacheKey()
export function computeContentHash(content: string): string {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

// LRU cache for per-file Tailwind class scan results w/ content hash validation, TTL expiration & LRU eviction
export class TailwindScanCache {
  private cache: ContentHashCache<string[]>;

  constructor(options: TailwindScanCacheOptions = {}) {
    this.cache = new ContentHashCache<string[]>({
      maxEntries: options.maxEntries ?? SCAN_CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: options.ttlMs ?? CACHE_DEFAULT_TTL_MS,
    });
  }

  // get cached scan result if content hash matches & not expired
  // return null if miss/expired/mismatch
  get(fsPath: string, contentHash: string): string[] | null {
    const result = this.cache.getIfHashMatches(fsPath, contentHash);
    if (result !== null) {
      debug(`[${LogTags.TAILWIND_SCAN}] Cache hit for ${fsPath}`);
    }
    return result;
  }

  // store scan result for a file w/ its content hash
  set(fsPath: string, contentHash: string, classes: string[]): void {
    this.cache.setWithHash(fsPath, contentHash, classes);
  }

  // invalidate cached scan result for a specific file
  // call when file is known to have changed (e.g., from DependencyWatcher)
  invalidate(fsPath: string): void {
    if (this.cache.delete(fsPath)) {
      debug(`[${LogTags.TAILWIND_SCAN}] Invalidated cache for ${fsPath}`);
    }
  }

  // clear all cached scan results
  clear(): void {
    this.cache.clear();
    debug(`[${LogTags.TAILWIND_SCAN}] Cache cleared`);
  }

  // get current cache size (for debugging/testing)
  get size(): number {
    return this.cache.size;
  }
}

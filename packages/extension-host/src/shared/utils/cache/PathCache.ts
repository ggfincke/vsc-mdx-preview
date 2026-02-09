// packages/extension/utils/cache/PathCache.ts
// WatchableCache helper for path-based keys

import type { LogTag } from '@mdx-preview/shared';
import { WatchableCache } from './WatchableCache';

export interface PathCacheOptions {
  // label for watcher logging
  logTag: LogTag;
  // max LRU entries (optional)
  maxEntries?: number;
  // cache TTL in milliseconds (optional)
  ttlMs?: number;
}

export class PathCache<V> extends WatchableCache<string, V> {
  constructor(options: PathCacheOptions) {
    super(options);
  }

  invalidateByPrefix(prefix: string): void {
    this.invalidateWhere((key) => key.startsWith(prefix));
  }
}

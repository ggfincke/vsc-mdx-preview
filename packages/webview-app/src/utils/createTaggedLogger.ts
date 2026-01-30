// packages/webview-app/src/utils/createTaggedLogger.ts
// factory for creating tagged debug loggers w/ consistent prefix

import type { TaggedLogger, LogTag } from '@mdx-preview/shared';
import { debug, info, warn, error } from './debug';

// re-export TaggedLogger type for convenience
export type { TaggedLogger, LogTag } from '@mdx-preview/shared';

// creates a tagged logger w/ a fixed prefix for consistent debug output
// all methods are no-ops in production builds
export function createTaggedLogger(tag: LogTag): TaggedLogger {
  const prefix = `[${tag}]`;

  return {
    debug: (...args: unknown[]) => debug(prefix, ...args),
    info: (...args: unknown[]) => info(prefix, ...args),
    warn: (...args: unknown[]) => warn(prefix, ...args),
    error: (...args: unknown[]) => error(prefix, ...args),
  };
}

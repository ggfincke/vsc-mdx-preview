// packages/webview-app/src/utils/createTaggedLogger.ts
// Factory for creating tagged debug loggers w/ consistent prefix

import { debug, debugWarn, debugError } from './debug';

// a logger instance w/ a fixed tag prefix (all methods are no-ops in production)
export interface TaggedLogger {
  // log a debug message w/ the tag prefix
  debug: (...args: unknown[]) => void;
  // log a warning message w/ the tag prefix
  warn: (...args: unknown[]) => void;
  // log an error message w/ the tag prefix
  error: (...args: unknown[]) => void;
}

// creates a tagged logger w/ a fixed prefix for consistent debug output
export function createTaggedLogger(tag: string): TaggedLogger {
  const prefix = `[${tag}]`;

  return {
    debug: (...args: unknown[]) => debug(prefix, ...args),
    warn: (...args: unknown[]) => debugWarn(prefix, ...args),
    error: (...args: unknown[]) => debugError(prefix, ...args),
  };
}

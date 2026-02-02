// packages/shared/logging/factory.ts
// shared factory for creating tagged loggers

import type { LogFnVariadic, TaggedLogger } from './types';
import type { LogTag } from './tags';

// base logger interface that tagged logger factory requires
export interface BaseLoggerVariadic {
  debug: LogFnVariadic;
  info: LogFnVariadic;
  warn: LogFnVariadic;
  error: LogFnVariadic;
}

// create TaggedLogger factory w/ prefix
export function createTaggedLoggerFactory(
  baseLogger: BaseLoggerVariadic
): (tag: LogTag | string) => TaggedLogger {
  return (tag: LogTag | string): TaggedLogger => {
    const prefix = `[${tag}]`;

    return {
      debug: (...args: unknown[]) => baseLogger.debug(prefix, ...args),
      info: (...args: unknown[]) => baseLogger.info(prefix, ...args),
      warn: (...args: unknown[]) => baseLogger.warn(prefix, ...args),
      error: (...args: unknown[]) => baseLogger.error(prefix, ...args),
    };
  };
}

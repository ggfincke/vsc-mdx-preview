// packages/contracts/src/logging/factory.ts
// shared factory for creating tagged loggers

import type {
  LoggerVariadic,
  TaggedLogger,
  TaggedLoggerFactory,
} from './types';
import type { LogTag } from './tags';

// base logger shape that tagged logger factory requires
export type BaseLoggerVariadic = LoggerVariadic;

// create TaggedLogger factory w/ prefix
export function createTaggedLoggerFactory(
  baseLogger: LoggerVariadic
): TaggedLoggerFactory {
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

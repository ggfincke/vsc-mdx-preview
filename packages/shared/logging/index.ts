// packages/shared/logging/index.ts
// barrel export for shared logging types & tags

export {
  LogLevel,
  type LogFn,
  type LogFnVariadic,
  type Logger,
  type LoggerVariadic,
  type TaggedLogger,
  type TaggedLoggerFactory,
} from './types';

export { LogTags, type LogTag } from './tags';

export { createTaggedLoggerFactory, type BaseLoggerVariadic } from './factory';

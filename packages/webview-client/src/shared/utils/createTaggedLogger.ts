// packages/webview-app/src/utils/createTaggedLogger.ts
// factory for creating tagged debug loggers w/ consistent prefix

import { createTaggedLoggerFactory } from '@mdx-preview/contracts';
import { logger } from './debug';

// re-export TaggedLogger type for convenience
export type { LogTag, TaggedLogger } from '@mdx-preview/contracts';

// create tagged logger using shared factory w/ webview's base logger
// all methods are no-ops in production builds (via debug.ts logger)
export const createTaggedLogger = createTaggedLoggerFactory(logger);

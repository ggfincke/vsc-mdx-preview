// packages/webview-client/src/shared/utils/debug.ts
// debug logging utilities stripped in production builds (uses import.meta.env.DEV)

import type { LoggerVariadic } from '@mdx-preview/contracts';

// default logger instance (dev-only, all no-ops in production)
// consumed by createTaggedLogger.ts as the base logger for the webview
export const logger: LoggerVariadic = import.meta.env.DEV
  ? {
      debug: (...args: unknown[]) => console.log(...args),
      info: (...args: unknown[]) => console.info(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      error: (...args: unknown[]) => console.error(...args),
    }
  : {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

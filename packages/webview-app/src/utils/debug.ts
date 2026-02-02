// packages/webview-app/src/utils/debug.ts
// debug logging utilities stripped in production builds (uses import.meta.env.DEV)

import type { LogFnVariadic, LoggerVariadic } from '@mdx-preview/shared';

// log a debug message (only outputs in development mode)
export const debug: LogFnVariadic = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

// log an info message (only outputs in development mode)
export const info: LogFnVariadic = import.meta.env.DEV
  ? (...args: unknown[]) => console.info(...args)
  : () => {};

// log a warning message (only outputs in development mode)
export const warn: LogFnVariadic = import.meta.env.DEV
  ? (...args: unknown[]) => console.warn(...args)
  : () => {};

// log an error message (only outputs in development mode)
export const error: LogFnVariadic = import.meta.env.DEV
  ? (...args: unknown[]) => console.error(...args)
  : () => {};

// start a console group (only outputs in development mode)
export const debugGroup: (label: string) => void = import.meta.env.DEV
  ? (label: string) => console.group(label)
  : () => {};

// end a console group (only outputs in development mode)
export const debugGroupEnd: () => void = import.meta.env.DEV
  ? () => console.groupEnd()
  : () => {};

// default logger instance (dev-only, all no-ops in production)
export const logger: LoggerVariadic = {
  debug,
  info,
  warn,
  error,
};

// re-export TaggedLogger type for convenience
export type { TaggedLogger } from '@mdx-preview/shared';

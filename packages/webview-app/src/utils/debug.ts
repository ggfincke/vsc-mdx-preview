/**
 * Debug logging utilities that are stripped in production builds.
 * Uses import.meta.env.DEV to conditionally enable logging.
 */

type LogFn = (...args: unknown[]) => void;

/**
 * Log a debug message. Only outputs in development mode.
 */
export const debug: LogFn = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

/**
 * Log a warning message. Only outputs in development mode.
 */
export const debugWarn: LogFn = import.meta.env.DEV
  ? (...args: unknown[]) => console.warn(...args)
  : () => {};

/**
 * Log an error message. Only outputs in development mode.
 */
export const debugError: LogFn = import.meta.env.DEV
  ? (...args: unknown[]) => console.error(...args)
  : () => {};

/**
 * Start a console group. Only outputs in development mode.
 */
export const debugGroup: (label: string) => void = import.meta.env.DEV
  ? (label: string) => console.group(label)
  : () => {};

/**
 * End a console group. Only outputs in development mode.
 */
export const debugGroupEnd: () => void = import.meta.env.DEV
  ? () => console.groupEnd()
  : () => {};

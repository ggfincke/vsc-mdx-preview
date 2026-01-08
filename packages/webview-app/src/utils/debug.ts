// packages/webview-app/src/utils/debug.ts
// debug logging utilities stripped in production builds (uses import.meta.env.DEV)

type LogFn = (...args: unknown[]) => void;

// log a debug message (only outputs in development mode)
export const debug: LogFn = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

// log a warning message (only outputs in development mode)
export const debugWarn: LogFn = import.meta.env.DEV
  ? (...args: unknown[]) => console.warn(...args)
  : () => {};

// log an error message (only outputs in development mode)
export const debugError: LogFn = import.meta.env.DEV
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

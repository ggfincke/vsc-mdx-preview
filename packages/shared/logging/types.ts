// packages/shared/logging/types.ts
// shared logging type definitions for extension & webview packages

// log severity levels
export enum LogLevel {
  Debug = 'DEBUG',
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
}

// base log function signature (extension-style: message + optional data)
export type LogFn = (message: string, data?: unknown) => void;

// variadic log function signature (webview-style: spread args)
export type LogFnVariadic = (...args: unknown[]) => void;

// core logger interface w/ standard log levels (extension-style)
export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

// variadic logger interface (webview-style w/ spread args)
export interface LoggerVariadic {
  debug: LogFnVariadic;
  info: LogFnVariadic;
  warn: LogFnVariadic;
  error: LogFnVariadic;
}

// tagged logger w/ fixed prefix (all methods variadic for flexibility)
export interface TaggedLogger {
  debug: LogFnVariadic;
  info: LogFnVariadic;
  warn: LogFnVariadic;
  error: LogFnVariadic;
}

// tagged logger factory function signature
export type TaggedLoggerFactory = (tag: string) => TaggedLogger;

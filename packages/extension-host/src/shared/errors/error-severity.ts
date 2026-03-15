// packages/extension-host/src/shared/errors/error-severity.ts
// severity enums & inference helpers for error reporting

import { ExtensionError } from './index';
import { ModuleError } from '@mdx-preview/contracts';

// error severity determines handling behavior
export enum ErrorSeverity {
  // debug: log only, no user notification
  Debug = 'debug',
  // info: log only, show in output channel
  Info = 'info',
  // warning: log + optional notification (toast)
  Warning = 'warning',
  // error: log + webview error display OR notification
  Error = 'error',
  // critical: log + notification + may require user action
  Critical = 'critical',
}

// context for where the error originated
export enum ErrorContext {
  // errors during module resolution/fetching
  ModuleFetch = 'module-fetch',
  // errors during MDX/TS/JS transpilation
  Transpile = 'transpile',
  // security-related errors
  Security = 'security',
  // configuration parsing errors
  Config = 'config',
  // webview communication errors
  Webview = 'webview',
  // tailwind CSS processing errors
  Tailwind = 'tailwind',
  // plugin loading errors
  Plugin = 'plugin',
  // general extension errors
  Extension = 'extension',
}

// infer severity from error type & context
export function inferSeverity(
  error: Error | ExtensionError | ModuleError,
  context: ErrorContext
): ErrorSeverity {
  // security errors are always critical or warning
  if (error instanceof ExtensionError) {
    if (error.code === 'PATH_TRAVERSAL') {
      return ErrorSeverity.Critical;
    }
    if (error.code === 'TRUST_VIOLATION') {
      return ErrorSeverity.Warning;
    }
  }

  // context-based severity mapping
  switch (context) {
    case ErrorContext.Security:
      return ErrorSeverity.Critical;
    // show in webview
    case ErrorContext.ModuleFetch:
    case ErrorContext.Transpile:
      return ErrorSeverity.Error;
    case ErrorContext.Config:
    case ErrorContext.Plugin:
      return ErrorSeverity.Warning;
    // non-blocking
    case ErrorContext.Tailwind:
      return ErrorSeverity.Warning;
    case ErrorContext.Webview:
    case ErrorContext.Extension:
    default:
      return ErrorSeverity.Error;
  }
}

// check if error is recoverable (user can fix & retry)
export function isRecoverableError(error: Error): boolean {
  if (error instanceof ModuleError) {
    return error.recoverable;
  }
  if (error instanceof ExtensionError) {
    // module & transpile errors are typically recoverable by fixing the source
    const recoverableCodes = [
      // module error codes
      // module not found
      'E100',
      // circular dependency
      'E102',
      // parse error
      'E110',
      // transform error
      'E120',
      // transpile codes
      // MDX transpile
      'E300',
    ];
    return recoverableCodes.includes(error.code);
  }
  return true;
}

// get user-friendly context prefix
export function getContextPrefix(context: ErrorContext): string {
  const prefixes: Record<ErrorContext, string> = {
    [ErrorContext.ModuleFetch]: 'MDX Preview',
    [ErrorContext.Transpile]: 'MDX Preview',
    [ErrorContext.Security]: 'MDX Preview Security',
    [ErrorContext.Config]: 'MDX Preview Config',
    [ErrorContext.Webview]: 'MDX Preview',
    [ErrorContext.Tailwind]: 'MDX Preview Tailwind',
    [ErrorContext.Plugin]: 'MDX Preview Plugin',
    [ErrorContext.Extension]: 'MDX Preview',
  };
  return prefixes[context];
}

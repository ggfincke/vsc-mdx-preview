// packages/extension-host/src/shared/errors/index.ts
// structured error classes for extension w/ error codes & context

import {
  type ModuleErrorCode,
  type ModuleErrorData,
  ModuleError,
} from '@mdx-preview/contracts';

export { ErrorReporter, type ReportOptions } from './ErrorReporter';
export { ErrorSeverity, ErrorContext } from './error-severity';
export { type WebviewErrorHandle } from './error-notification';

// re-export notification helpers for direct consumers
export { notifyInfo, notifyWarning, notifyError } from './error-notification';

// re-export shared module error types for convenience
export { ModuleError, type ModuleErrorCode, type ModuleErrorData };

// re-export error factories from shared package
export {
  type ExtensionModuleErrorCode,
  createModuleNotFoundError,
  createOutsideWorkspaceError,
  createParseError,
  createTransformError,
} from '@mdx-preview/contracts';

// base error class w/ error code for programmatic handling
export class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

// security violation errors
export type SecurityErrorCode = 'PATH_TRAVERSAL' | 'TRUST_VIOLATION';

export class SecurityError extends ExtensionError {
  constructor(
    message: string,
    code: SecurityErrorCode,
    public readonly attemptedPath?: string
  ) {
    super(message, code);
  }
}

// path access denied error (migrated from checkFsPath.ts)
export class PathAccessDeniedError extends SecurityError {
  public readonly fsPath: string;

  constructor(fsPath: string) {
    super(
      `Accessing ${fsPath} denied. This path is outside of your workspace folders. Please make sure you have all dependencies inside your workspace.`,
      'PATH_TRAVERSAL',
      fsPath
    );
    this.fsPath = fsPath;
  }
}

// config errors
export type ConfigErrorCode = 'CONFIG_PARSE_ERROR' | 'CONFIG_VALIDATION_ERROR';

export class ConfigError extends ExtensionError {
  constructor(
    message: string,
    code: ConfigErrorCode,
    public readonly configPath?: string,
    cause?: Error
  ) {
    super(message, code, cause);
  }
}

// tailwind errors: install, version, config & plugin failures
export type TailwindErrorCode =
  'E500' | 'E501' | 'E520' | 'TAILWIND_COMPILATION_ERROR' | 'E562';

export class TailwindError extends ExtensionError {
  constructor(
    message: string,
    code: TailwindErrorCode,
    public readonly phase?: 'detect' | 'config' | 'scan' | 'compile',
    cause?: Error
  ) {
    super(message, code, cause);
  }
}

// webview errors: manifest, handshake & RPC failures
export type WebviewErrorCode = 'E600' | 'E620' | 'E640';

export class WebviewError extends ExtensionError {
  constructor(
    message: string,
    code: WebviewErrorCode,
    public readonly phase?: 'init' | 'handshake' | 'rpc',
    cause?: Error
  ) {
    super(message, code, cause);
  }
}

// service errors: missing, disposed & circular registrations
export type ServiceErrorCode = 'E800' | 'E801' | 'E802';

export class ServiceError extends ExtensionError {
  constructor(
    message: string,
    code: ServiceErrorCode,
    public readonly serviceName?: string,
    cause?: Error
  ) {
    super(message, code, cause);
  }
}

// circular dependency error for service registry
export class CircularDependencyError extends ServiceError {
  constructor(public readonly cycle: string[]) {
    const cycleStr = cycle.join(' -> ');
    super(
      `Circular service dependency detected: ${cycleStr}`,
      'E802',
      cycle[0]
    );
  }
}

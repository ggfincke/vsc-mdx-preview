// packages/extension/errors/index.ts
// structured error classes for extension w/ error codes & context

export {
  ErrorReporter,
  ErrorSeverity,
  ErrorContext,
  type WebviewErrorHandle,
  type ReportOptions,
} from './ErrorReporter';

export { ErrorCode } from './error-codes';

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

// module resolution & fetch errors
export type ModuleFetchErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'OUTSIDE_WORKSPACE'
  | 'PARSE_ERROR'
  | 'TRANSFORM_ERROR';

export class ModuleFetchError extends ExtensionError {
  constructor(
    message: string,
    code: ModuleFetchErrorCode,
    public readonly modulePath?: string,
    public readonly parentModule?: string,
    cause?: Error
  ) {
    super(message, code, cause);
  }
}

// transpilation errors w/ source location
export class TranspileError extends ExtensionError {
  constructor(
    message: string,
    public readonly sourceFile: string,
    public readonly line?: number,
    public readonly column?: number,
    cause?: Error
  ) {
    super(message, 'TRANSPILE_ERROR', cause);
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

// plugin errors
export type PluginErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_ERROR'
  | 'PLUGIN_INVALID_EXPORT';

export class PluginError extends ExtensionError {
  constructor(
    message: string,
    code: PluginErrorCode,
    public readonly pluginName: string,
    cause?: Error
  ) {
    super(message, code, cause);
  }
}

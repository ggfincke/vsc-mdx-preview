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
// E460 = PLUGIN_SAFE_MODE_BLOCKED
export type PluginErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_ERROR'
  | 'PLUGIN_INVALID_EXPORT'
  | 'E460';

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

// tailwind errors
// E500 = TAILWIND_NOT_INSTALLED
// E501 = TAILWIND_VERSION_UNSUPPORTED
// E520 = TAILWIND_CONFIG_NOT_FOUND
// E562 = TAILWIND_INVALID_PLUGIN
export type TailwindErrorCode =
  | 'E500'
  | 'E501'
  | 'E520'
  | 'TAILWIND_COMPILATION_ERROR'
  | 'E562';

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

// webview errors
// E600 = WEBVIEW_MANIFEST_ERROR
// E620 = WEBVIEW_HANDSHAKE_TIMEOUT
// E640 = WEBVIEW_RPC_ERROR
export type WebviewErrorCode =
  | 'E600'
  | 'E620'
  | 'E640';

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

// service errors
// E800 = SERVICE_NOT_REGISTERED
// E801 = SERVICE_ALREADY_DISPOSED
// E802 = SERVICE_CIRCULAR_DEPENDENCY
export type ServiceErrorCode =
  | 'E800'
  | 'E801'
  | 'E802';

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

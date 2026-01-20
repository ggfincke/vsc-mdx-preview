// packages/extension/errors/ErrorReporter.ts
// centralized error reporting service for consistent error handling

import * as vscode from 'vscode';
import { ExtensionError } from './index';
import { formatUserError, formatLogError } from './messages';
import {
  error as logError,
  warn as logWarn,
  debug as logDebug,
} from '../logging';
import {
  ERROR_DEDUPE_WINDOW_DEFAULT_MS,
  ERROR_DEDUPE_MAX_ENTRIES,
} from '../constants';
import { SingletonService } from '../services/SingletonService';

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
  // Tailwind CSS processing errors
  Tailwind = 'tailwind',
  // plugin loading errors
  Plugin = 'plugin',
  // general extension errors
  Extension = 'extension',
}

// interface for webview error display
export interface WebviewErrorHandle {
  showPreviewError(error: {
    message: string;
    code?: string;
    stack?: string;
    context?: string;
    recoverable?: boolean;
  }): void;
}

// options for reporting an error
export interface ReportOptions {
  // override auto-detected severity
  severity?: ErrorSeverity;
  // error context for categorization
  context: ErrorContext;
  // send error to webview for display
  showInWebview?: boolean;
  // webview handle for webview errors
  webviewHandle?: WebviewErrorHandle;
  // show VS Code notification
  showNotification?: boolean;
  // additional data for logging
  metadata?: Record<string, unknown>;
  // suppress duplicate errors within timeframe (ms)
  dedupeWindow?: number;
}

// * centralized error reporting service
// provides consistent error handling across the extension:
// - automatic severity inference based on error type & context
// - unified logging w/ context
// - configurable user notifications
// - webview error display integration
// - duplicate error suppression
export class ErrorReporter extends SingletonService<ErrorReporter> {
  protected static override instance: ErrorReporter | undefined;
  protected readonly logTag = 'ERROR-REPORTER';

  private recentErrors = new Map<string, number>();
  private readonly DEFAULT_DEDUPE_WINDOW = ERROR_DEDUPE_WINDOW_DEFAULT_MS;

  protected constructor() {
    super();
  }

  // * main error reporting method
  // logs the error & optionally shows it to the user
  report(
    error: Error | ExtensionError | unknown,
    options: ReportOptions
  ): void {
    const normalizedError = this.normalizeError(error);
    const severity =
      options.severity ?? this.inferSeverity(normalizedError, options.context);

    // Check for duplicate suppression
    if (this.isDuplicate(normalizedError, options.dedupeWindow)) {
      logDebug(
        `[ERROR-REPORTER] Suppressed duplicate: ${normalizedError.message}`
      );
      return;
    }

    // always log (level based on severity)
    this.logError(normalizedError, severity, options);

    // handle notifications based on severity & options
    if (options.showInWebview && options.webviewHandle) {
      this.sendToWebview(
        normalizedError,
        options.webviewHandle,
        options.context
      );
    } else if (this.shouldNotify(severity, options)) {
      this.showNotification(normalizedError, severity, options.context);
    }
  }

  // convenience method for webview errors - logs & displays the error in the webview
  reportWebviewError(
    error: Error | ExtensionError | unknown,
    webviewHandle: WebviewErrorHandle,
    context: ErrorContext = ErrorContext.Extension
  ): void {
    this.report(error, {
      context,
      showInWebview: true,
      webviewHandle,
    });
  }

  // convenience method for background/silent errors - only logs, never shows to user
  reportSilent(
    error: Error | ExtensionError | unknown,
    context: ErrorContext,
    metadata?: Record<string, unknown>
  ): void {
    this.report(error, {
      context,
      severity: ErrorSeverity.Debug,
      showNotification: false,
      showInWebview: false,
      metadata,
    });
  }

  // convenience method for user-facing errors - logs & shows a notification
  reportToUser(
    error: Error | ExtensionError | unknown,
    context: ErrorContext
  ): void {
    this.report(error, {
      context,
      severity: ErrorSeverity.Error,
      showNotification: true,
    });
  }

  // convenience method for config errors - logs & shows warning notification
  reportConfigError(
    error: Error | ExtensionError | unknown,
    configPath?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.report(error, {
      context: ErrorContext.Config,
      severity: ErrorSeverity.Warning,
      showNotification: true,
      metadata: { configPath, ...metadata },
    });
  }

  // convenience method for plugin errors - logs but does NOT show notification
  // plugin errors are expected in Safe Mode & should not interrupt user
  reportPluginError(
    error: Error | ExtensionError | unknown,
    pluginName: string
  ): void {
    this.report(error, {
      context: ErrorContext.Plugin,
      severity: ErrorSeverity.Warning,
      showNotification: false,
      metadata: { pluginName },
    });
  }

  // convenience method for interactive errors w/ action buttons
  // logs the error & shows a warning w/ clickable actions
  async reportWithActions(
    error: Error | ExtensionError | unknown,
    context: ErrorContext,
    actions: { label: string; action: () => void | Promise<void> }[]
  ): Promise<void> {
    const normalizedError = this.normalizeError(error);
    const message =
      normalizedError instanceof ExtensionError
        ? formatUserError(normalizedError)
        : normalizedError.message;

    // log the error
    this.logError(normalizedError, ErrorSeverity.Warning, { context });

    // show warning w/ action buttons
    const actionLabels = actions.map((a) => a.label);
    const prefix = this.getContextPrefix(context);
    const selection = await vscode.window.showWarningMessage(
      `${prefix}: ${message}`,
      ...actionLabels
    );

    // execute selected action
    const selectedAction = actions.find((a) => a.label === selection);
    if (selectedAction) {
      await selectedAction.action();
    }
  }

  // normalize any error type to ExtensionError or Error
  private normalizeError(error: unknown): ExtensionError | Error {
    if (error instanceof ExtensionError) {
      return error;
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  // infer severity from error type & context
  private inferSeverity(
    error: Error | ExtensionError,
    context: ErrorContext
  ): ErrorSeverity {
    // Security errors are always critical or warning
    if (error instanceof ExtensionError) {
      if (error.code === 'PATH_TRAVERSAL') {
        return ErrorSeverity.Critical;
      }
      if (error.code === 'TRUST_VIOLATION') {
        return ErrorSeverity.Warning;
      }
    }

    // Context-based severity mapping
    switch (context) {
      case ErrorContext.Security:
        return ErrorSeverity.Critical;
      case ErrorContext.ModuleFetch:
      case ErrorContext.Transpile:
        // show in webview
        return ErrorSeverity.Error;
      case ErrorContext.Config:
      case ErrorContext.Plugin:
        return ErrorSeverity.Warning;
      case ErrorContext.Tailwind:
        // non-blocking
        return ErrorSeverity.Warning;
      case ErrorContext.Webview:
      case ErrorContext.Extension:
      default:
        return ErrorSeverity.Error;
    }
  }

  // log error at appropriate level
  private logError(
    error: ExtensionError | Error,
    severity: ErrorSeverity,
    options: ReportOptions
  ): void {
    const logData =
      error instanceof ExtensionError
        ? formatLogError(error)
        : { message: error.message, stack: error.stack };

    if (options.metadata) {
      Object.assign(logData, { context: options.context, ...options.metadata });
    }

    const prefix = `[${options.context.toUpperCase()}]`;

    switch (severity) {
      case ErrorSeverity.Debug:
        logDebug(`${prefix} ${error.message}`, logData);
        break;
      case ErrorSeverity.Info:
      case ErrorSeverity.Warning:
        logWarn(`${prefix} ${error.message}`, logData);
        break;
      case ErrorSeverity.Error:
      case ErrorSeverity.Critical:
        logError(`${prefix} ${error.message}`, logData);
        break;
    }
  }

  // determine if notification should be shown
  private shouldNotify(
    severity: ErrorSeverity,
    options: ReportOptions
  ): boolean {
    // explicit override
    if (options.showNotification !== undefined) {
      return options.showNotification;
    }
    // webview errors don't also show notifications
    if (options.showInWebview) {
      return false;
    }
    // default: notify for Warning & above
    return (
      severity === ErrorSeverity.Warning ||
      severity === ErrorSeverity.Error ||
      severity === ErrorSeverity.Critical
    );
  }

  // show VS Code notification
  private showNotification(
    error: ExtensionError | Error,
    severity: ErrorSeverity,
    context: ErrorContext
  ): void {
    const message =
      error instanceof ExtensionError ? formatUserError(error) : error.message;

    const prefix = this.getContextPrefix(context);
    const fullMessage = `${prefix}: ${message}`;

    switch (severity) {
      case ErrorSeverity.Warning:
        vscode.window.showWarningMessage(fullMessage);
        break;
      case ErrorSeverity.Error:
        vscode.window.showErrorMessage(fullMessage);
        break;
      case ErrorSeverity.Critical:
        vscode.window
          .showErrorMessage(fullMessage, 'Show Output')
          .then((selection) => {
            if (selection === 'Show Output') {
              vscode.commands.executeCommand(
                'workbench.action.output.toggleOutput'
              );
            }
          });
        break;
    }
  }

  // send error to webview w/ context & recoverable hint
  private sendToWebview(
    error: ExtensionError | Error,
    handle: WebviewErrorHandle,
    context?: ErrorContext
  ): void {
    const message =
      error instanceof ExtensionError ? formatUserError(error) : error.message;

    handle.showPreviewError({
      message,
      code: error instanceof ExtensionError ? error.code : undefined,
      stack: error.stack,
      context: context,
      recoverable: this.isRecoverableError(error),
    });
  }

  // check if error is recoverable (user can fix & retry)
  private isRecoverableError(error: Error): boolean {
    if (error instanceof ExtensionError) {
      // Module & transpile errors are typically recoverable by fixing the source
      const recoverableCodes = [
        'MODULE_NOT_FOUND',
        'PARSE_ERROR',
        'TRANSPILE_ERROR',
        'E102', // circular dependency
        'E120', // parse error
        'E300', // MDX transpile
      ];
      return recoverableCodes.includes(error.code);
    }
    return true;
  }

  // get user-friendly context prefix
  private getContextPrefix(context: ErrorContext): string {
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

  // check for duplicate errors
  private isDuplicate(error: Error, dedupeWindow?: number): boolean {
    const key = `${error.constructor.name}:${error.message}`;
    const now = Date.now();
    const window = dedupeWindow ?? this.DEFAULT_DEDUPE_WINDOW;

    const lastSeen = this.recentErrors.get(key);
    if (lastSeen && now - lastSeen < window) {
      return true;
    }

    // FIFO eviction: if map exceeds max size, delete oldest entries
    if (this.recentErrors.size >= ERROR_DEDUPE_MAX_ENTRIES) {
      this.evictOldestEntries(Math.ceil(ERROR_DEDUPE_MAX_ENTRIES * 0.1));
    }

    this.recentErrors.set(key, now);
    this.cleanupOldErrors(now - window);
    return false;
  }

  // FIFO eviction of oldest entries when map exceeds size limit
  private evictOldestEntries(count: number): void {
    let evicted = 0;
    for (const key of this.recentErrors.keys()) {
      if (evicted >= count) {
        break;
      }
      this.recentErrors.delete(key);
      evicted++;
    }
    logDebug(`[${this.logTag}] Evicted ${evicted} oldest entries (FIFO)`);
  }

  // clean up old error entries
  private cleanupOldErrors(threshold: number): void {
    for (const [key, time] of this.recentErrors) {
      if (time < threshold) {
        this.recentErrors.delete(key);
      }
    }
  }

  // custom cleanup - clear recent errors map
  protected override onDispose(): void {
    this.recentErrors.clear();
  }
}

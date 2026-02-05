// packages/extension/errors/ErrorReporter.ts
// centralized error reporting service for consistent error handling

import * as vscode from 'vscode';
import { ExtensionError } from './index';
import { formatUserError, formatLogError } from './messages';
import type { PreviewError } from '@mdx-preview/shared';
import {
  error as logError,
  warn as logWarn,
  debug as logDebug,
  createTaggedLogger,
} from '../logging';
import {
  ERROR_DEDUPE_WINDOW_DEFAULT_MS,
  ERROR_DEDUPE_MAX_ENTRIES,
} from '../constants';
import { SingletonService } from '../services/SingletonService';
import {
  LRUCache,
  LogTags,
  ModuleError,
  normalizeError as sharedNormalizeError,
} from '@mdx-preview/shared';

// module-level tagged logger for error reporter
const log = createTaggedLogger(LogTags.ERROR_REPORTER);

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

// interface for webview error display
export interface WebviewErrorHandle {
  showPreviewError(error: PreviewError): void;
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
// provide consistent error handling across the extension w/ automatic severity
// inference, unified logging, configurable notifications, & dedupe
export class ErrorReporter extends SingletonService<ErrorReporter> {
  protected static override instance: ErrorReporter | undefined;
  protected readonly logTag = LogTags.ERROR_REPORTER;

  // LRU cache for duplicate error tracking w/ capacity-based eviction
  private recentErrors: LRUCache<string, number>;
  private readonly DEFAULT_DEDUPE_WINDOW = ERROR_DEDUPE_WINDOW_DEFAULT_MS;

  protected constructor() {
    super();
    // no TTL - check timestamps manually to support custom dedupeWindow
    this.recentErrors = new LRUCache({
      maxEntries: ERROR_DEDUPE_MAX_ENTRIES,
    });
  }

  // main error reporting method
  // log the error & optionally show it to the user
  report(
    error: Error | ExtensionError | ModuleError | unknown,
    options: ReportOptions
  ): void {
    const normalizedError = this.normalizeError(error);
    const severity =
      options.severity ?? this.inferSeverity(normalizedError, options.context);

    // check for duplicate suppression
    if (this.isDuplicate(normalizedError, options.dedupeWindow)) {
      log.debug(`Suppressed duplicate: ${normalizedError.message}`);
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

  // convenience method for webview errors - log & display in webview
  reportWebviewError(
    error: Error | ExtensionError | ModuleError | unknown,
    webviewHandle: WebviewErrorHandle,
    context: ErrorContext = ErrorContext.Extension
  ): void {
    this.report(error, {
      context,
      showInWebview: true,
      webviewHandle,
    });
  }

  // convenience method for background/silent errors - log only, never show to user
  reportSilent(
    error: Error | ExtensionError | ModuleError | unknown,
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

  // convenience method for user-facing errors - log & show notification
  reportToUser(
    error: Error | ExtensionError | ModuleError | unknown,
    context: ErrorContext
  ): void {
    this.report(error, {
      context,
      severity: ErrorSeverity.Error,
      showNotification: true,
    });
  }

  // convenience method for config errors - log & show warning notification
  reportConfigError(
    error: Error | ExtensionError | ModuleError | unknown,
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

  // convenience method for plugin errors - log but do NOT show notification
  // plugin errors are expected in Safe Mode & should not interrupt the user
  reportPluginError(
    error: Error | ExtensionError | ModuleError | unknown,
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
  // log the error & show a warning w/ clickable actions
  async reportWithActions(
    error: Error | ExtensionError | ModuleError | unknown,
    context: ErrorContext,
    actions: { label: string; action: () => void | Promise<void> }[]
  ): Promise<void> {
    const normalizedError = this.normalizeError(error);
    const message =
      normalizedError instanceof ExtensionError ||
      normalizedError instanceof ModuleError
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

  // normalize any error type to ExtensionError, ModuleError, or Error
  // preserves extension-specific error types, falls back to shared normalizeError
  private normalizeError(error: unknown): ExtensionError | ModuleError | Error {
    // preserve extension-specific error types
    if (error instanceof ExtensionError) {
      return error;
    }
    if (error instanceof ModuleError) {
      return error;
    }
    // use shared normalizeError for generic errors
    return sharedNormalizeError(error);
  }

  // infer severity from error type & context
  private inferSeverity(
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

  // log error at appropriate level
  private logError(
    error: ExtensionError | Error,
    severity: ErrorSeverity,
    options: ReportOptions
  ): void {
    const logData =
      error instanceof ExtensionError || error instanceof ModuleError
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
    // webview errors do not also show notifications
    if (options.showInWebview) {
      return false;
    }
    // default - notify for Warning & above
    return (
      severity === ErrorSeverity.Warning ||
      severity === ErrorSeverity.Error ||
      severity === ErrorSeverity.Critical
    );
  }

  // show VS Code notification
  private showNotification(
    error: ExtensionError | ModuleError | Error,
    severity: ErrorSeverity,
    context: ErrorContext
  ): void {
    const message =
      error instanceof ExtensionError || error instanceof ModuleError
        ? formatUserError(error)
        : error.message;

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
    error: ExtensionError | ModuleError | Error,
    handle: WebviewErrorHandle,
    context?: ErrorContext
  ): void {
    const message =
      error instanceof ExtensionError || error instanceof ModuleError
        ? formatUserError(error)
        : error.message;

    const previewError: PreviewError = {
      message,
      code:
        error instanceof ExtensionError || error instanceof ModuleError
          ? error.code
          : undefined,
      stack: error.stack,
      context: context,
      recoverable: this.isRecoverableError(error),
    };

    // include module error data for ModuleError
    if (error instanceof ModuleError) {
      previewError.moduleError = error.toModuleErrorData();
    }

    handle.showPreviewError(previewError);
  }

  // check if error is recoverable (user can fix & retry)
  private isRecoverableError(error: Error): boolean {
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

  // check for duplicate errors using LRU cache w/ auto-eviction
  private isDuplicate(error: Error, dedupeWindow?: number): boolean {
    const key = `${error.constructor.name}:${error.message}`;
    const now = Date.now();
    const window = dedupeWindow ?? this.DEFAULT_DEDUPE_WINDOW;

    const lastSeen = this.recentErrors.get(key);
    if (lastSeen !== null && now - lastSeen < window) {
      return true;
    }

    // not a duplicate - record timestamp (LRU auto-evicts when full)
    this.recentErrors.set(key, now);
    return false;
  }

  // custom cleanup - clear recent errors map
  protected override onDispose(): void {
    this.recentErrors.clear();
  }
}

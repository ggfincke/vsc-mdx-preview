// packages/extension-host/src/shared/errors/ErrorReporter.ts
// centralized error reporting service for consistent error handling

import * as vscode from 'vscode';
import { ExtensionError } from './index';
import { formatLogError } from './messages';
import {
  error as logError,
  warn as logWarn,
  debug as logDebug,
  createTaggedLogger,
} from '../logging/logger';
import {
  ERROR_DEDUPE_WINDOW_DEFAULT_MS,
  ERROR_DEDUPE_MAX_ENTRIES,
} from '../constants';
import { SingletonService } from '../../app/services/SingletonService';
import { LogTags, ModuleError } from '@mdx-preview/contracts';
import {
  LRUCache,
  normalizeError as sharedNormalizeError,
} from '@mdx-preview/runtime-utils';
import {
  ErrorSeverity,
  ErrorContext,
  inferSeverity,
  getContextPrefix,
} from './error-severity';
import {
  type WebviewErrorHandle,
  shouldNotify,
  showNotification,
  sendToWebview,
  userDisplayMessage,
} from './error-notification';

// re-export enums, interfaces, & types for consumers
export { ErrorSeverity, ErrorContext } from './error-severity';
export { type WebviewErrorHandle } from './error-notification';

// module-level tagged logger for error reporter
const log = createTaggedLogger(LogTags.ERROR_REPORTER);

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
    const normalizedError = sharedNormalizeError(error);
    const severity =
      options.severity ?? inferSeverity(normalizedError, options.context);

    // check for duplicate suppression
    if (this.isDuplicate(normalizedError, options.dedupeWindow)) {
      log.debug(`Suppressed duplicate: ${normalizedError.message}`);
      return;
    }

    // always log (level based on severity)
    this.logError(normalizedError, severity, options);

    // handle notifications based on severity & options
    if (options.showInWebview && options.webviewHandle) {
      sendToWebview(normalizedError, options.webviewHandle, options.context);
    } else if (
      shouldNotify(severity, options.showNotification, options.showInWebview)
    ) {
      showNotification(normalizedError, severity, options.context);
    }
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

  // convenience method for interactive errors w/ action buttons
  // log the error & show a warning w/ clickable actions
  async reportWithActions(
    error: Error | ExtensionError | ModuleError | unknown,
    context: ErrorContext,
    actions: { label: string; action: () => void | Promise<void> }[]
  ): Promise<void> {
    const normalizedError = sharedNormalizeError(error);
    const message = userDisplayMessage(normalizedError);

    // log the error
    this.logError(normalizedError, ErrorSeverity.Warning, { context });

    // show warning w/ action buttons
    const actionLabels = actions.map((a) => a.label);
    const prefix = getContextPrefix(context);
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

  // log error at appropriate level
  private logError(
    error: ExtensionError | Error,
    severity: ErrorSeverity,
    options: Pick<ReportOptions, 'context' | 'metadata'>
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

  // check for duplicate errors using LRU cache w/ auto-eviction
  private isDuplicate(error: Error, dedupeWindow?: number): boolean {
    const key = `${error.constructor.name}:${error.message}`;
    const now = Date.now();
    const window = dedupeWindow ?? ERROR_DEDUPE_WINDOW_DEFAULT_MS;

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

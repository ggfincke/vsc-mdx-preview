// packages/extension-host/src/shared/errors/error-notification.ts
// VS Code notification routing & webview error display

import * as vscode from 'vscode';
import { ExtensionError } from './index';
import { formatUserError } from './messages';
import type { PreviewError } from '@mdx-preview/contracts';
import { ModuleError } from '@mdx-preview/contracts';
import {
  ErrorSeverity,
  ErrorContext,
  isRecoverableError,
  getContextPrefix,
} from './error-severity';
import { EXTENSION_DISPLAY_NAME } from '../constants';

// prepend the brand prefix to a message body for command notifications
function withBrandPrefix(message: string): string {
  return `${EXTENSION_DISPLAY_NAME}: ${message}`;
}

// brand-prefixed information notification
export function notifyInfo(message: string): Thenable<string | undefined> {
  return vscode.window.showInformationMessage(withBrandPrefix(message));
}

// brand-prefixed warning notification
export function notifyWarning(message: string): Thenable<string | undefined> {
  return vscode.window.showWarningMessage(withBrandPrefix(message));
}

// brand-prefixed error notification
export function notifyError(message: string): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(withBrandPrefix(message));
}

// interface for webview error display
export interface WebviewErrorHandle {
  showPreviewError(error: PreviewError): void;
}

// determine if notification should be shown
export function shouldNotify(
  severity: ErrorSeverity,
  showNotification?: boolean,
  showInWebview?: boolean
): boolean {
  // explicit override
  if (showNotification !== undefined) {
    return showNotification;
  }
  // webview errors do not also show notifications
  if (showInWebview) {
    return false;
  }
  // default - notify for Warning & above
  return (
    severity === ErrorSeverity.Warning ||
    severity === ErrorSeverity.Error ||
    severity === ErrorSeverity.Critical
  );
}

// format error for user display (structured errors via formatUserError)
export function userDisplayMessage(error: Error): string {
  return error instanceof ExtensionError || error instanceof ModuleError
    ? formatUserError(error)
    : error.message;
}

// show VS Code notification
export function showNotification(
  error: ExtensionError | ModuleError | Error,
  severity: ErrorSeverity,
  context: ErrorContext
): void {
  const message = userDisplayMessage(error);

  const prefix = getContextPrefix(context);
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
export function sendToWebview(
  error: ExtensionError | ModuleError | Error,
  handle: WebviewErrorHandle,
  context?: ErrorContext
): void {
  const message = userDisplayMessage(error);

  const previewError: PreviewError = {
    message,
    code:
      error instanceof ExtensionError || error instanceof ModuleError
        ? error.code
        : undefined,
    stack: error.stack,
    context: context,
    recoverable: isRecoverableError(error),
  };

  // include module error data for ModuleError
  if (error instanceof ModuleError) {
    previewError.moduleError = error.toModuleErrorData();
  }

  handle.showPreviewError(previewError);
}

// tests/extension/errors/ErrorReporter.test.ts
// verify representative notification & dedupe contracts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

const { mockLogDebug, mockLogWarn, mockLogError, mockTaggedDebug } = vi.hoisted(
  () => ({
    mockLogDebug: vi.fn(),
    mockLogWarn: vi.fn(),
    mockLogError: vi.fn(),
    mockTaggedDebug: vi.fn(),
  })
);

vi.mock('../../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: mockLogDebug,
  info: vi.fn(),
  warn: mockLogWarn,
  error: mockLogError,
  createTaggedLogger: vi.fn(() => ({
    debug: mockTaggedDebug,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import {
  ErrorContext,
  ErrorReporter,
  ErrorSeverity,
  type WebviewErrorHandle,
} from '../../../packages/extension-host/src/shared/errors';

describe('ErrorReporter', () => {
  beforeEach(() => {
    ErrorReporter.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes inferred & explicitly overridden severities to notifications', () => {
    const showErrorMessage = vi.spyOn(vscode.window, 'showErrorMessage');
    const showWarningMessage = vi.spyOn(vscode.window, 'showWarningMessage');
    const reporter = ErrorReporter.getInstance();

    reporter.report(new Error('err'), {
      context: ErrorContext.Extension,
      severity: ErrorSeverity.Error,
    });

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('err')
    );

    showErrorMessage.mockClear();
    reporter.reportToUser(new Error('user-facing'), ErrorContext.Extension);
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('user-facing')
    );

    showErrorMessage.mockClear();
    reporter.report(new Error('override'), {
      context: ErrorContext.Security,
      severity: ErrorSeverity.Warning,
    });

    expect(showWarningMessage).toHaveBeenCalled();
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('scopes duplicate logs by context & severity inside the window', () => {
    vi.useFakeTimers();
    const reporter = ErrorReporter.getInstance();
    const error = new Error('dup');

    reporter.report(error, {
      context: ErrorContext.Extension,
      severity: ErrorSeverity.Debug,
    });
    vi.clearAllMocks();
    reporter.report(error, {
      context: ErrorContext.Extension,
      severity: ErrorSeverity.Debug,
    });

    expect(mockTaggedDebug).toHaveBeenCalledWith(
      expect.stringContaining('Suppressed duplicate')
    );

    reporter.report(error, {
      context: ErrorContext.Config,
      severity: ErrorSeverity.Debug,
    });
    reporter.report(error, {
      context: ErrorContext.Config,
      severity: ErrorSeverity.Warning,
      showNotification: false,
    });

    expect(mockLogDebug).toHaveBeenCalledTimes(1);
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
  });

  it('dedupes logs & notifications without suppressing webview state', () => {
    vi.useFakeTimers();
    const reporter = ErrorReporter.getInstance();
    const showErrorMessage = vi.spyOn(vscode.window, 'showErrorMessage');
    let visibleMessage: string | undefined;
    const showPreviewError = vi.fn<WebviewErrorHandle['showPreviewError']>(
      (previewError) => {
        visibleMessage = previewError.message;
      }
    );
    const replacementShowPreviewError =
      vi.fn<WebviewErrorHandle['showPreviewError']>();
    const recurringError = new Error('recurring');

    reporter.report(recurringError, {
      context: ErrorContext.Transpile,
      severity: ErrorSeverity.Error,
      showInWebview: true,
      webviewHandle: { showPreviewError },
    });
    expect(visibleMessage).toBe('recurring');

    // successful content clears the current webview error
    visibleMessage = undefined;
    reporter.report(recurringError, {
      context: ErrorContext.Transpile,
      severity: ErrorSeverity.Error,
      showInWebview: true,
      webviewHandle: { showPreviewError },
    });
    expect(visibleMessage).toBe('recurring');
    expect(showPreviewError).toHaveBeenCalledTimes(2);

    reporter.report(recurringError, {
      context: ErrorContext.Transpile,
      severity: ErrorSeverity.Error,
      showInWebview: true,
      webviewHandle: { showPreviewError: replacementShowPreviewError },
    });
    expect(replacementShowPreviewError).toHaveBeenCalledTimes(1);
    expect(showErrorMessage).not.toHaveBeenCalled();

    mockLogDebug.mockClear();
    mockLogError.mockClear();
    const destinationError = new Error('destination-specific');
    reporter.reportSilent(destinationError, ErrorContext.Extension);
    reporter.reportToUser(destinationError, ErrorContext.Extension);
    reporter.reportToUser(destinationError, ErrorContext.Extension);

    expect(mockLogDebug).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it('logs silent reports without showing notifications', () => {
    const showErrorMessage = vi.spyOn(vscode.window, 'showErrorMessage');
    const showWarningMessage = vi.spyOn(vscode.window, 'showWarningMessage');

    ErrorReporter.getInstance().reportSilent(
      new Error('silent'),
      ErrorContext.Extension
    );

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(showWarningMessage).not.toHaveBeenCalled();
    expect(mockLogDebug).toHaveBeenCalled();
  });

  it('executes selected reportWithActions callbacks', async () => {
    const showWarningMessage = vi
      .spyOn(vscode.window, 'showWarningMessage')
      .mockResolvedValue('Fix' as never);
    const action = vi.fn();

    await ErrorReporter.getInstance().reportWithActions(
      new Error('fixable'),
      ErrorContext.Extension,
      [
        { label: 'Fix', action },
        { label: 'Cancel', action: vi.fn() },
      ]
    );

    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('fixable'),
      'Fix',
      'Cancel'
    );
    expect(action).toHaveBeenCalled();
  });
});

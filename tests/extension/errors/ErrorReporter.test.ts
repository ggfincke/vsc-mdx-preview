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
} from '../../../packages/extension-host/src/shared/errors';

describe('ErrorReporter', () => {
  beforeEach(() => {
    ErrorReporter.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows user-facing errors for error severity', () => {
    const showErrorMessage = vi.spyOn(vscode.window, 'showErrorMessage');
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
  });

  it('allows explicit severity to override context inference', () => {
    const showWarningMessage = vi.spyOn(vscode.window, 'showWarningMessage');
    const showErrorMessage = vi.spyOn(vscode.window, 'showErrorMessage');

    ErrorReporter.getInstance().report(new Error('override'), {
      context: ErrorContext.Security,
      severity: ErrorSeverity.Warning,
    });

    expect(showWarningMessage).toHaveBeenCalled();
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('suppresses duplicate errors inside the dedupe window', () => {
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

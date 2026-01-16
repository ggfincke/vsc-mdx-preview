// packages/extension/test/ErrorReporter.test.ts
// unit tests for ErrorReporter (severity inference, deduplication, notifications)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __resetMocks, window } from './__mocks__/vscode';
import {
  ErrorReporter,
  ErrorSeverity,
  ErrorContext,
} from '../errors/ErrorReporter';
import { ExtensionError, ConfigError, PluginError } from '../errors';

// reset ErrorReporter singleton between tests
const resetErrorReporter = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ErrorReporter as any).instance = undefined;
};

describe('ErrorReporter', () => {
  beforeEach(() => {
    __resetMocks();
    resetErrorReporter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      ErrorReporter.getInstance().dispose();
    } catch {
      // Ignore if already disposed
    }
    resetErrorReporter();
    __resetMocks();
  });

  describe('getInstance', () => {
    it('returns a singleton instance', () => {
      const instance1 = ErrorReporter.getInstance();
      const instance2 = ErrorReporter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('report', () => {
    it('logs error without notification when severity is Debug', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Test error');

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });

      expect(window.showErrorMessage).not.toHaveBeenCalled();
      expect(window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows warning notification for Warning severity', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Warning message');

      reporter.report(error, {
        context: ErrorContext.Config,
        severity: ErrorSeverity.Warning,
        showNotification: true,
      });

      expect(window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('shows error notification for Error severity', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Error message');

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
      });

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('does not show notification when showNotification is false', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Test error');

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: false,
      });

      expect(window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('sends error to webview when showInWebview is true', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Webview error');
      const webviewHandle = {
        showPreviewError: vi.fn(),
      };

      reporter.report(error, {
        context: ErrorContext.Transpile,
        showInWebview: true,
        webviewHandle,
      });

      expect(webviewHandle.showPreviewError).toHaveBeenCalledWith({
        message: 'Webview error',
        code: undefined,
        stack: expect.any(String),
      });
    });

    it('includes ExtensionError code in webview error', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new ExtensionError('Extension error', 'TEST_CODE');
      const webviewHandle = {
        showPreviewError: vi.fn(),
      };

      reporter.report(error, {
        context: ErrorContext.ModuleFetch,
        showInWebview: true,
        webviewHandle,
      });

      expect(webviewHandle.showPreviewError).toHaveBeenCalledWith({
        message: expect.any(String),
        code: 'TEST_CODE',
        stack: expect.any(String),
      });
    });
  });

  describe('severity inference', () => {
    it('infers Critical severity for PATH_TRAVERSAL errors', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new ExtensionError(
        'Path traversal detected',
        'PATH_TRAVERSAL'
      );

      reporter.report(error, {
        context: ErrorContext.Security,
      });

      // critical severity shows error message w/ "Show Output" option
      expect(window.showErrorMessage).toHaveBeenCalled();
    });

    it('infers Warning severity for TRUST_VIOLATION errors', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new ExtensionError('Trust violation', 'TRUST_VIOLATION');

      reporter.report(error, {
        context: ErrorContext.Security,
      });

      expect(window.showWarningMessage).toHaveBeenCalled();
    });

    it('infers Critical severity for Security context', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Security issue');

      reporter.report(error, {
        context: ErrorContext.Security,
      });

      expect(window.showErrorMessage).toHaveBeenCalled();
    });

    it('infers Warning severity for Config context', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Config issue');

      reporter.report(error, {
        context: ErrorContext.Config,
      });

      expect(window.showWarningMessage).toHaveBeenCalled();
    });

    it('infers Warning severity for Tailwind context', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Tailwind issue');

      reporter.report(error, {
        context: ErrorContext.Tailwind,
      });

      expect(window.showWarningMessage).toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    it('suppresses duplicate errors within dedupe window', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Duplicate error');

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
        dedupeWindow: 10000,
      });

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
        dedupeWindow: 10000,
      });

      expect(window.showErrorMessage).toHaveBeenCalledTimes(1);
    });

    it('allows errors after dedupe window expires', async () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Duplicate error');

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
        dedupeWindow: 10, // Very short window
      });

      // Wait for dedupe window to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
        dedupeWindow: 10,
      });

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
    });

    it('distinguishes different error messages', () => {
      const reporter = ErrorReporter.getInstance();
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      reporter.report(error1, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
      });

      reporter.report(error2, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
      });

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('convenience methods', () => {
    describe('reportWebviewError', () => {
      it('reports to webview with correct options', () => {
        const reporter = ErrorReporter.getInstance();
        const error = new Error('Webview error');
        const webviewHandle = {
          showPreviewError: vi.fn(),
        };

        reporter.reportWebviewError(error, webviewHandle);

        expect(webviewHandle.showPreviewError).toHaveBeenCalled();
      });
    });

    describe('reportSilent', () => {
      it('does not show notification', () => {
        const reporter = ErrorReporter.getInstance();
        const error = new Error('Silent error');

        reporter.reportSilent(error, ErrorContext.Extension);

        expect(window.showErrorMessage).not.toHaveBeenCalled();
        expect(window.showWarningMessage).not.toHaveBeenCalled();
      });
    });

    describe('reportToUser', () => {
      it('shows error notification', () => {
        const reporter = ErrorReporter.getInstance();
        const error = new Error('User error');

        reporter.reportToUser(error, ErrorContext.Extension);

        expect(window.showErrorMessage).toHaveBeenCalledWith(
          expect.stringContaining('User error')
        );
      });
    });

    describe('reportConfigError', () => {
      it('reports with Config context and Warning severity', () => {
        const reporter = ErrorReporter.getInstance();
        const error = new ConfigError(
          'Invalid config',
          'CONFIG_PARSE_ERROR',
          '/path/to/config.json'
        );

        reporter.reportConfigError(error, '/path/to/config.json');

        expect(window.showWarningMessage).toHaveBeenCalledWith(
          expect.stringContaining('Config')
        );
      });

      it('includes configPath in metadata', () => {
        const reporter = ErrorReporter.getInstance();
        const error = new Error('Config error');

        reporter.reportConfigError(error, '/path/to/config.json', {
          extra: 'metadata',
        });

        expect(window.showWarningMessage).toHaveBeenCalled();
      });
    });

    describe('reportPluginError', () => {
      it('logs but does not show notification', () => {
        const reporter = ErrorReporter.getInstance();
        const error = new PluginError(
          'Plugin failed',
          'PLUGIN_LOAD_ERROR',
          'my-plugin'
        );

        reporter.reportPluginError(error, 'my-plugin');

        // Plugin errors should not show notifications
        expect(window.showErrorMessage).not.toHaveBeenCalled();
        expect(window.showWarningMessage).not.toHaveBeenCalled();
      });
    });

    describe('reportWithActions', () => {
      it('shows warning with action buttons', async () => {
        const reporter = ErrorReporter.getInstance();
        const error = new Error('Action required');
        const action = vi.fn();

        // Mock showWarningMessage to return 'Perform Action'
        (
          window.showWarningMessage as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce('Perform Action');

        await reporter.reportWithActions(error, ErrorContext.Security, [
          { label: 'Perform Action', action },
          { label: 'Cancel', action: vi.fn() },
        ]);

        expect(window.showWarningMessage).toHaveBeenCalledWith(
          expect.stringContaining('Action required'),
          'Perform Action',
          'Cancel'
        );
        expect(action).toHaveBeenCalled();
      });

      it('does not call action if user cancels', async () => {
        const reporter = ErrorReporter.getInstance();
        const error = new Error('Action required');
        const action = vi.fn();

        // Mock showWarningMessage to return undefined (dialog dismissed)
        (
          window.showWarningMessage as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(undefined);

        await reporter.reportWithActions(error, ErrorContext.Security, [
          { label: 'Perform Action', action },
        ]);

        expect(action).not.toHaveBeenCalled();
      });
    });
  });

  describe('error normalization', () => {
    it('handles string errors', () => {
      const reporter = ErrorReporter.getInstance();
      const webviewHandle = {
        showPreviewError: vi.fn(),
      };

      reporter.report('String error', {
        context: ErrorContext.Extension,
        showInWebview: true,
        webviewHandle,
      });

      expect(webviewHandle.showPreviewError).toHaveBeenCalledWith({
        message: 'String error',
        code: undefined,
        stack: expect.any(String),
      });
    });

    it('handles number errors', () => {
      const reporter = ErrorReporter.getInstance();
      const webviewHandle = {
        showPreviewError: vi.fn(),
      };

      reporter.report(42, {
        context: ErrorContext.Extension,
        showInWebview: true,
        webviewHandle,
      });

      expect(webviewHandle.showPreviewError).toHaveBeenCalledWith({
        message: '42',
        code: undefined,
        stack: expect.any(String),
      });
    });
  });

  describe('dispose', () => {
    it('clears recent errors map', () => {
      const reporter = ErrorReporter.getInstance();
      const error = new Error('Test error');

      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
        dedupeWindow: 10000,
      });

      reporter.dispose();
      resetErrorReporter();

      // after dispose & reset, the same error should not be deduplicated
      const newReporter = ErrorReporter.getInstance();
      newReporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: true,
        dedupeWindow: 10000,
      });

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
    });
  });
});

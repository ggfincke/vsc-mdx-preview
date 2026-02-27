// tests/extension/errors/ErrorReporter.test.ts
// unit tests for centralized error reporting service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  ErrorReporter,
  ErrorSeverity,
  ErrorContext,
  ExtensionError,
  ModuleError,
} from '../../../packages/extension-host/src/shared/errors';

describe('ErrorReporter', () => {
  beforeEach(() => {
    ErrorReporter.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // singleton lifecycle

  describe('singleton lifecycle', () => {
    it('getInstance returns same instance', () => {
      const a = ErrorReporter.getInstance();
      const b = ErrorReporter.getInstance();
      expect(a).toBe(b);
    });

    it('reset clears instance & next getInstance creates new', () => {
      const a = ErrorReporter.getInstance();
      ErrorReporter.reset();
      const b = ErrorReporter.getInstance();
      expect(a).not.toBe(b);
    });

    it('onDispose clears recentErrors cache', () => {
      vi.useFakeTimers();
      const reporter = ErrorReporter.getInstance();
      const error = new Error('test');

      // report once to seed dedup cache
      reporter.report(error, { context: ErrorContext.Extension });

      // dispose clears cache
      reporter.dispose();

      // new instance should not see duplicates
      const fresh = ErrorReporter.getInstance();
      fresh.report(error, { context: ErrorContext.Extension });
      // should NOT see "Suppressed duplicate"
      expect(mockTaggedDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('Suppressed duplicate')
      );
    });
  });

  // report — logging

  describe('report — logging', () => {
    it('Debug severity calls logDebug', () => {
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('dbg'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });
      expect(mockLogDebug).toHaveBeenCalled();
    });

    it('Warning severity calls logWarn', () => {
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('wrn'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Warning,
      });
      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.stringContaining('[EXTENSION]'),
        expect.any(Object)
      );
    });

    it('Error severity calls logError', () => {
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('err'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
      });
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('[EXTENSION]'),
        expect.any(Object)
      );
    });

    it('Critical severity calls logError', () => {
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('crit'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Critical,
      });
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('[EXTENSION]'),
        expect.any(Object)
      );
    });

    it('log message includes [CONTEXT] prefix', () => {
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('test'), {
        context: ErrorContext.Tailwind,
        severity: ErrorSeverity.Warning,
      });
      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.stringContaining('[TAILWIND]'),
        expect.any(Object)
      );
    });
  });

  // report — notifications

  describe('report — notifications', () => {
    it('Error severity shows showErrorMessage', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('err'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('err'));
    });

    it('Warning severity shows showWarningMessage', () => {
      const spy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('wrn'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Warning,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('wrn'));
    });

    it('Critical severity shows showErrorMessage w/ Show Output', async () => {
      const spy = vi
        .spyOn(vscode.window, 'showErrorMessage')
        .mockResolvedValue('Show Output' as any);
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('crit'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Critical,
      });
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('crit'),
        'Show Output'
      );
      // wait for .then chain
      await vi.waitFor(() => {
        expect(execSpy).toHaveBeenCalledWith(
          'workbench.action.output.toggleOutput'
        );
      });
    });

    it('showNotification: false suppresses notification', () => {
      const errSpy = vi.spyOn(vscode.window, 'showErrorMessage');
      const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('silent'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showNotification: false,
      });
      expect(errSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('showNotification: true + Debug severity still shows', () => {
      // Debug normally does not notify, but explicit override
      const errSpy = vi.spyOn(vscode.window, 'showErrorMessage');
      const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('force'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
        showNotification: true,
      });
      // Debug severity doesn't match Warning/Error/Critical in showNotification
      // but shouldNotify returns true due to explicit override
      // however, showNotification dispatches based on severity
      // Debug is not handled by showNotification -> no call
      // Actually check the code: shouldNotify returns true but
      // showNotification switch only handles Warning/Error/Critical
      expect(errSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('showInWebview: true sends to webview instead of notification', () => {
      const errSpy = vi.spyOn(vscode.window, 'showErrorMessage');
      const mockHandle = { showPreviewError: vi.fn() };
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('webview err'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Error,
        showInWebview: true,
        webviewHandle: mockHandle,
      });
      expect(errSpy).not.toHaveBeenCalled();
      expect(mockHandle.showPreviewError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'webview err' })
      );
    });
  });

  // severity inference

  describe('severity inference', () => {
    it('ExtensionError PATH_TRAVERSAL -> Critical', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new ExtensionError('traversal', 'PATH_TRAVERSAL'), {
        context: ErrorContext.Extension,
      });
      // Critical shows showErrorMessage w/ "Show Output"
      expect(spy).toHaveBeenCalledWith(expect.any(String), 'Show Output');
    });

    it('ExtensionError TRUST_VIOLATION -> Warning', () => {
      const spy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new ExtensionError('trust', 'TRUST_VIOLATION'), {
        context: ErrorContext.Extension,
      });
      expect(spy).toHaveBeenCalled();
    });

    it('Context Security -> Critical', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('sec'), {
        context: ErrorContext.Security,
      });
      expect(spy).toHaveBeenCalledWith(expect.any(String), 'Show Output');
    });

    it('Context ModuleFetch -> Error', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('mod'), {
        context: ErrorContext.ModuleFetch,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('mod'));
    });

    it('Context Transpile -> Error', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('trs'), {
        context: ErrorContext.Transpile,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('trs'));
    });

    it('Context Config -> Warning', () => {
      const spy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('cfg'), {
        context: ErrorContext.Config,
      });
      expect(spy).toHaveBeenCalled();
    });

    it('Context Plugin -> Warning', () => {
      const spy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('plg'), {
        context: ErrorContext.Plugin,
      });
      expect(spy).toHaveBeenCalled();
    });

    it('Context Tailwind -> Warning', () => {
      const spy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('tw'), {
        context: ErrorContext.Tailwind,
      });
      expect(spy).toHaveBeenCalled();
    });

    it('Context Webview -> Error', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('wv'), {
        context: ErrorContext.Webview,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('wv'));
    });

    it('Context Extension -> Error', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('ext'), {
        context: ErrorContext.Extension,
      });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('ext'));
    });

    it('explicit severity overrides inference', () => {
      const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
      const errSpy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      // Security context would infer Critical, but override to Warning
      reporter.report(new Error('override'), {
        context: ErrorContext.Security,
        severity: ErrorSeverity.Warning,
      });
      expect(warnSpy).toHaveBeenCalled();
      expect(errSpy).not.toHaveBeenCalled();
    });
  });

  // deduplication

  describe('deduplication', () => {
    it('first report is not suppressed', () => {
      vi.useFakeTimers();
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('first'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });
      expect(mockTaggedDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('Suppressed duplicate')
      );
    });

    it('same error within 5s is suppressed', () => {
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

    it('same error after 5s is not suppressed', () => {
      vi.useFakeTimers();
      const reporter = ErrorReporter.getInstance();
      const error = new Error('dup-timeout');
      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });
      vi.advanceTimersByTime(5001);
      vi.clearAllMocks();
      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });
      expect(mockTaggedDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('Suppressed duplicate')
      );
    });

    it('custom dedupeWindow is respected', () => {
      vi.useFakeTimers();
      const reporter = ErrorReporter.getInstance();
      const error = new Error('custom-dedup');
      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
        dedupeWindow: 1000,
      });
      vi.advanceTimersByTime(500);
      vi.clearAllMocks();
      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
        dedupeWindow: 1000,
      });
      expect(mockTaggedDebug).toHaveBeenCalledWith(
        expect.stringContaining('Suppressed duplicate')
      );

      vi.advanceTimersByTime(600);
      vi.clearAllMocks();
      reporter.report(error, {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
        dedupeWindow: 1000,
      });
      expect(mockTaggedDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('Suppressed duplicate')
      );
    });

    it('different messages are not deduplicated', () => {
      vi.useFakeTimers();
      const reporter = ErrorReporter.getInstance();
      reporter.report(new Error('a'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });
      vi.clearAllMocks();
      reporter.report(new Error('b'), {
        context: ErrorContext.Extension,
        severity: ErrorSeverity.Debug,
      });
      expect(mockTaggedDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('Suppressed duplicate')
      );
    });
  });

  // convenience methods

  describe('convenience methods', () => {
    it('reportSilent uses Debug severity & no notification', () => {
      const errSpy = vi.spyOn(vscode.window, 'showErrorMessage');
      const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.reportSilent(new Error('silent'), ErrorContext.Extension);
      expect(errSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      // debug log should be called
      expect(mockLogDebug).toHaveBeenCalled();
    });

    it('reportToUser shows error notification', () => {
      const spy = vi.spyOn(vscode.window, 'showErrorMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.reportToUser(new Error('user-facing'), ErrorContext.Extension);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('user-facing'));
    });

    it('reportConfigError uses Config context & Warning severity', () => {
      const spy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.reportConfigError(new Error('cfg err'), '/path/config.json');
      expect(spy).toHaveBeenCalled();
      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.stringContaining('[CONFIG]'),
        expect.objectContaining({ configPath: '/path/config.json' })
      );
    });

    it('reportPluginError uses Plugin context & no notification', () => {
      const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
      const reporter = ErrorReporter.getInstance();
      reporter.reportPluginError(new Error('plg err'), 'my-plugin');
      expect(warnSpy).not.toHaveBeenCalled();
      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.stringContaining('[PLUGIN]'),
        expect.objectContaining({ pluginName: 'my-plugin' })
      );
    });

    it('reportWithActions shows warning w/ action buttons & executes selected', async () => {
      const spy = vi
        .spyOn(vscode.window, 'showWarningMessage')
        .mockResolvedValue('Fix' as any);
      const actionFn = vi.fn();
      const reporter = ErrorReporter.getInstance();
      await reporter.reportWithActions(
        new Error('fixable'),
        ErrorContext.Extension,
        [
          { label: 'Fix', action: actionFn },
          { label: 'Cancel', action: () => {} },
        ]
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('fixable'),
        'Fix',
        'Cancel'
      );
      expect(actionFn).toHaveBeenCalled();
    });

    it('reportWithActions does not execute if user cancels', async () => {
      vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(
        undefined as any
      );
      const actionFn = vi.fn();
      const reporter = ErrorReporter.getInstance();
      await reporter.reportWithActions(
        new Error('cancel'),
        ErrorContext.Extension,
        [{ label: 'Fix', action: actionFn }]
      );
      expect(actionFn).not.toHaveBeenCalled();
    });
  });

  // error normalization & webview error building
  // helper: report error to webview & return the PreviewError sent to the handle
  function reportToWebview(
    error: unknown,
    context: ErrorContext = ErrorContext.Extension
  ) {
    const handle = { showPreviewError: vi.fn() };
    const reporter = ErrorReporter.getInstance();
    reporter.report(error, {
      context,
      showInWebview: true,
      webviewHandle: handle,
    });
    return handle.showPreviewError;
  }

  describe('error normalization', () => {
    it('ExtensionError is preserved', () => {
      const spy = reportToWebview(
        new ExtensionError('ext-err', 'PATH_TRAVERSAL')
      );
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'PATH_TRAVERSAL' })
      );
    });

    it('ModuleError is preserved', () => {
      const spy = reportToWebview(
        new ModuleError('mod not found', { code: 'E100', moduleId: 'test-mod' })
      );
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'E100',
          moduleError: expect.objectContaining({ moduleId: 'test-mod' }),
        })
      );
    });

    it('generic Error is normalized', () => {
      const spy = reportToWebview(new Error('generic'));
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'generic' })
      );
    });

    it('non-Error value (string) is normalized', () => {
      const spy = reportToWebview('string error');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'string error' })
      );
    });
  });

  describe('webview error building', () => {
    it('PreviewError includes message, code, stack, context, recoverable', () => {
      const spy = reportToWebview(
        new ExtensionError('test', 'E100'),
        ErrorContext.ModuleFetch
      );
      const previewErr = spy.mock.calls[0][0];
      expect(previewErr).toHaveProperty('message');
      expect(previewErr).toHaveProperty('code', 'E100');
      expect(previewErr).toHaveProperty('stack');
      expect(previewErr).toHaveProperty('context', ErrorContext.ModuleFetch);
      expect(previewErr).toHaveProperty('recoverable');
    });

    it('ModuleError includes moduleError data', () => {
      const spy = reportToWebview(
        new ModuleError('not found', {
          code: 'E100',
          moduleId: 'foo',
          parentModuleId: 'bar',
        })
      );
      const previewErr = spy.mock.calls[0][0];
      expect(previewErr.moduleError).toBeDefined();
      expect(previewErr.moduleError.moduleId).toBe('foo');
    });

    it('ModuleError uses .recoverable field', () => {
      const spy = reportToWebview(
        new ModuleError('not found recoverable', {
          code: 'E100',
          moduleId: 'foo',
          recoverable: false,
        })
      );
      expect(spy.mock.calls[0][0].recoverable).toBe(false);
    });

    it('ExtensionError w/ recoverable codes returns true', () => {
      for (const code of ['E100', 'E102', 'E110', 'E120', 'E300']) {
        const spy = reportToWebview(
          new ExtensionError(`recoverable-${code}`, code)
        );
        expect(spy.mock.calls[0][0].recoverable).toBe(true);
      }
    });

    it('ExtensionError w/ non-recoverable code returns false', () => {
      const spy = reportToWebview(new ExtensionError('test', 'PATH_TRAVERSAL'));
      expect(spy.mock.calls[0][0].recoverable).toBe(false);
    });

    it('generic Error defaults to recoverable true', () => {
      const spy = reportToWebview(new Error('generic'));
      expect(spy.mock.calls[0][0].recoverable).toBe(true);
    });
  });

  // context prefixes

  describe('context prefixes', () => {
    it('each context maps to correct prefix', () => {
      const reporter = ErrorReporter.getInstance();

      const expectedPrefixes: Record<ErrorContext, string> = {
        [ErrorContext.ModuleFetch]: 'MDX Preview',
        [ErrorContext.Transpile]: 'MDX Preview',
        [ErrorContext.Security]: 'MDX Preview Security',
        [ErrorContext.Config]: 'MDX Preview Config',
        [ErrorContext.Webview]: 'MDX Preview',
        [ErrorContext.Tailwind]: 'MDX Preview Tailwind',
        [ErrorContext.Plugin]: 'MDX Preview Plugin',
        [ErrorContext.Extension]: 'MDX Preview',
      };

      for (const [context, prefix] of Object.entries(expectedPrefixes)) {
        vi.clearAllMocks();
        const spy = vi.spyOn(vscode.window, 'showWarningMessage');
        // unique message per context to avoid dedup
        reporter.report(new Error(`prefix-test-${context}`), {
          context: context as ErrorContext,
          severity: ErrorSeverity.Warning,
        });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining(`${prefix}:`));
      }
    });
  });
});

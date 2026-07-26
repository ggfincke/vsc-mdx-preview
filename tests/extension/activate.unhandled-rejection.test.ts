// tests/extension/activate.unhandled-rejection.test.ts
// ensure unhandled promise rejections are logged without user popups

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ErrorContext,
  ErrorSeverity,
} from '../../packages/extension-host/src/shared/errors';
import { mockErrorReporter } from '../helpers/mock-services';
import {
  disposeUnhandledRejectionHandler,
  registerUnhandledRejectionHandler,
  reportUnhandledPromiseRejection,
} from '../../packages/extension-host/src/entry/activate';

describe('reportUnhandledPromiseRejection', () => {
  beforeEach(() => {
    mockErrorReporter.report.mockClear();
  });

  it('reports Error reasons without showing notifications', () => {
    reportUnhandledPromiseRejection(new TypeError('terminated'));

    expect(mockErrorReporter.report).toHaveBeenCalledTimes(1);
    const [error, options] = mockErrorReporter.report.mock.calls[0];
    expect((error as Error).message).toBe(
      'Unhandled promise rejection: terminated'
    );
    expect(options).toMatchObject({
      context: ErrorContext.Extension,
      severity: ErrorSeverity.Error,
      showNotification: false,
      metadata: { rejectionName: 'TypeError' },
    });
  });

  it('normalizes non-Error reasons to string messages', () => {
    reportUnhandledPromiseRejection('socket closed');

    expect(mockErrorReporter.report).toHaveBeenCalledTimes(1);
    const [error, options] = mockErrorReporter.report.mock.calls[0];
    expect((error as Error).message).toBe(
      'Unhandled promise rejection: socket closed'
    );
    expect(options).toMatchObject({
      context: ErrorContext.Extension,
      severity: ErrorSeverity.Error,
      showNotification: false,
      metadata: { rejectionValueType: 'string' },
    });
  });
});

describe('registerUnhandledRejectionHandler', () => {
  beforeEach(() => {
    disposeUnhandledRejectionHandler();
  });

  afterEach(() => {
    disposeUnhandledRejectionHandler();
  });

  it('registers one disposable process listener at a time', () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const offSpy = vi.spyOn(process, 'off').mockImplementation(() => process);
    const first = { subscriptions: [] as Array<{ dispose: () => void }> };
    const second = { subscriptions: [] as Array<{ dispose: () => void }> };

    registerUnhandledRejectionHandler(first as any);
    registerUnhandledRejectionHandler(first as any);

    expect(onSpy).toHaveBeenCalledTimes(1);
    expect(onSpy).toHaveBeenCalledWith(
      'unhandledRejection',
      expect.any(Function)
    );
    expect(first.subscriptions).toHaveLength(1);

    first.subscriptions[0].dispose();

    expect(offSpy).toHaveBeenCalledTimes(1);
    expect(offSpy).toHaveBeenCalledWith(
      'unhandledRejection',
      expect.any(Function)
    );

    registerUnhandledRejectionHandler(second as any);
    expect(onSpy).toHaveBeenCalledTimes(2);
    expect(second.subscriptions).toHaveLength(1);
  });
});

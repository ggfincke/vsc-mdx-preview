// tests/extension/activate.unhandled-rejection.test.ts
// ensure unhandled promise rejections are logged without user popups

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorContext,
  ErrorSeverity,
} from '../../packages/extension-host/src/shared/errors';
import { mockErrorReporter } from '../helpers/mock-services';
import { reportUnhandledPromiseRejection } from '../../packages/extension-host/src/entry/activate';

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

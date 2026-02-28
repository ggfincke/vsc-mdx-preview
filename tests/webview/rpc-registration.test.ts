// tests/webview/rpc-registration.test.ts
// unit tests for RPC handler registration retry orchestration

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebviewStateHandlers } from '../../packages/webview-client/src/platform/rpc/handler-factory';
import { createRpcRegistration } from '../../packages/webview-client/src/platform/rpc/rpc-registration';

function createHandlers(): WebviewStateHandlers {
  return {
    setTrustState: vi.fn(),
    setSafeContent: vi.fn(),
    setTrustedContent: vi.fn(),
    setError: vi.fn(),
    setStale: vi.fn(),
  };
}

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('createRpcRegistration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers successfully without retries', () => {
    const logger = createLogger();
    const setHandlers = vi.fn();
    const flush = vi.fn();
    const registration = createRpcRegistration({
      log: logger,
      maxRetries: 3,
      retryDelayMs: 100,
      warningThreshold: 10,
      setHandlers,
      flush,
      pendingCounts: () => ({ queued: 0, optional: 0 }),
    });

    registration.register(createHandlers());

    expect(setHandlers).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(registration.isInProgress()).toBe(false);
  });

  it('retries registration with exponential backoff after failure', async () => {
    const logger = createLogger();
    const setHandlers = vi.fn();
    const flush = vi
      .fn<() => void>()
      .mockImplementationOnce(() => {
        throw new Error('first failure');
      })
      .mockImplementationOnce(() => undefined);

    const registration = createRpcRegistration({
      log: logger,
      maxRetries: 3,
      retryDelayMs: 100,
      warningThreshold: 10,
      setHandlers,
      flush,
      pendingCounts: () => ({ queued: 0, optional: 0 }),
    });

    registration.register(createHandlers());
    expect(flush).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);

    expect(flush).toHaveBeenCalledTimes(2);
    expect(registration.isInProgress()).toBe(false);
  });

  it('stops retrying after max retries', async () => {
    const logger = createLogger();
    const flush = vi.fn(() => {
      throw new Error('always fail');
    });

    const registration = createRpcRegistration({
      log: logger,
      maxRetries: 2,
      retryDelayMs: 10,
      warningThreshold: 10,
      setHandlers: vi.fn(),
      flush,
      pendingCounts: () => ({ queued: 0, optional: 0 }),
    });

    registration.register(createHandlers());
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);

    expect(flush).toHaveBeenCalledTimes(3);
    expect(registration.isInProgress()).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed after 3 attempts'),
      expect.any(Error)
    );
  });

  it('ignores duplicate register calls while retry is in progress', () => {
    const logger = createLogger();
    const flush = vi.fn(() => {
      throw new Error('fail once');
    });

    const registration = createRpcRegistration({
      log: logger,
      maxRetries: 3,
      retryDelayMs: 100,
      warningThreshold: 10,
      setHandlers: vi.fn(),
      flush,
      pendingCounts: () => ({ queued: 0, optional: 0 }),
    });

    registration.register(createHandlers());
    expect(registration.isInProgress()).toBe(true);

    registration.register(createHandlers());

    expect(logger.debug).toHaveBeenCalledWith(
      'Registration already in progress, ignoring duplicate call'
    );
  });
});

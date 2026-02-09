// tests/extension/preview/watchers/BaseWatcher.test.ts
// unit tests for abstract BaseWatcher lifecycle management

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../packages/extension-host/src/shared/logging/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  createTaggedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../../packages/extension-host/src/shared/utils/disposable', () => ({
  disposeCollection: vi.fn(),
  disposeOne: vi.fn(),
}));

vi.mock('../../../../packages/extension-host/src/shared/utils/createFileWatcher', () => ({
  createFileWatcher: vi.fn(),
}));

import { BaseWatcher } from '../../../../packages/extension-host/src/features/preview/watchers/BaseWatcher';
import type { LogTag } from '@mdx-preview/shared';

// concrete test subclass w/ configurable callbacks
class TestWatcher extends BaseWatcher {
  protected readonly logTag = 'TEST-WATCHER' as LogTag;
  onStartCalled = 0;
  onStopCalled = 0;
  onDisposeCalled = 0;
  private _canStart = true;
  private _checkReadiness = true;

  setCanStart(val: boolean): void {
    this._canStart = val;
  }

  setCheckReadiness(val: boolean): void {
    this._checkReadiness = val;
  }

  protected override canStart(): boolean {
    return this._canStart;
  }

  protected override checkReadiness(): boolean {
    return this._checkReadiness;
  }

  protected async onStart(): Promise<void> {
    this.onStartCalled++;
  }

  protected onStop(): void {
    this.onStopCalled++;
  }

  protected override onDispose(): void {
    this.onDisposeCalled++;
  }

  // expose protected methods for testing
  public callMarkReady(): void {
    this.markReady();
  }

  public callUpdateAndRestartSync(fn: () => void): void {
    this.updateAndRestartSync(fn);
  }

  public async callUpdateAndRestart(fn: () => void): Promise<void> {
    await this.updateAndRestart(fn);
  }

  public callCreateDebouncedHandler<T extends (...args: never[]) => void>(
    fn: T,
    delayMs: number
  ): T & { cancel(): void; flush(): void } {
    return this.createDebouncedHandler(fn, delayMs);
  }
}

describe('BaseWatcher', () => {
  let watcher: TestWatcher;

  beforeEach(() => {
    watcher = new TestWatcher();
  });

  afterEach(() => {
    watcher.dispose();
    vi.useRealTimers();
  });

  // lifecycle

  describe('lifecycle', () => {
    it('start sets isActive true & calls onStart', async () => {
      await watcher.start();
      expect(watcher.isActive()).toBe(true);
      expect(watcher.onStartCalled).toBe(1);
    });

    it('start w/ canStart() returning false stays inactive', async () => {
      watcher.setCanStart(false);
      await watcher.start();
      expect(watcher.isActive()).toBe(false);
      expect(watcher.onStartCalled).toBe(0);
    });

    it('stop sets isActive false & calls onStop', async () => {
      await watcher.start();
      watcher.stop();
      expect(watcher.isActive()).toBe(false);
      expect(watcher.onStopCalled).toBe(1);
    });

    it('dispose calls stop then onDispose', async () => {
      await watcher.start();
      watcher.dispose();
      expect(watcher.onStopCalled).toBe(1);
      expect(watcher.onDisposeCalled).toBe(1);
    });
  });

  // readiness

  describe('readiness', () => {
    it('isReady returns true when active & checkReadiness true', async () => {
      await watcher.start();
      expect(watcher.isReady()).toBe(true);
    });

    it('isReady returns false when checkReadiness returns false', async () => {
      watcher.setCheckReadiness(false);
      await watcher.start();
      expect(watcher.isReady()).toBe(false);
    });

    it('waitForReady resolves immediately if already ready', async () => {
      await watcher.start();
      // should resolve without hanging
      await watcher.waitForReady();
    });

    it('waitForReady resolves after markReady', async () => {
      watcher.setCheckReadiness(false);
      await watcher.start();

      let resolved = false;
      const promise = watcher.waitForReady().then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      // make ready
      watcher.setCheckReadiness(true);
      watcher.callMarkReady();

      await promise;
      expect(resolved).toBe(true);
    });

    it('waitForReady w/ timeout rejects on timeout', async () => {
      vi.useFakeTimers();
      watcher.setCheckReadiness(false);
      await watcher.start();

      const promise = watcher.waitForReady(100);
      vi.advanceTimersByTime(101);

      await expect(promise).rejects.toThrow(/timeout/i);
    });
  });

  // update & restart

  describe('update & restart', () => {
    it('updateAndRestartSync: was active → stops, runs fn, restarts', async () => {
      await watcher.start();
      const fn = vi.fn();
      watcher.callUpdateAndRestartSync(fn);
      expect(watcher.onStopCalled).toBe(1);
      expect(fn).toHaveBeenCalled();
      // start is called again (void, not awaited)
      // but isActive may or may not be true yet since start is async
      // check that onStart was called again
      // We need a small delay for the void start
      await vi.waitFor(() => {
        expect(watcher.onStartCalled).toBe(2);
      });
    });

    it('updateAndRestartSync: was inactive → runs fn only', () => {
      const fn = vi.fn();
      watcher.callUpdateAndRestartSync(fn);
      expect(fn).toHaveBeenCalled();
      expect(watcher.onStartCalled).toBe(0);
      expect(watcher.onStopCalled).toBe(0);
    });

    it('updateAndRestart: async version awaits start', async () => {
      await watcher.start();
      const fn = vi.fn();
      await watcher.callUpdateAndRestart(fn);
      expect(watcher.onStopCalled).toBe(1);
      expect(fn).toHaveBeenCalled();
      expect(watcher.onStartCalled).toBe(2);
      expect(watcher.isActive()).toBe(true);
    });
  });

  // debounced handlers

  describe('debounced handlers', () => {
    it('createDebouncedHandler returns debounced function', async () => {
      vi.useFakeTimers();
      await watcher.start();
      const fn = vi.fn();
      const debounced = watcher.callCreateDebouncedHandler(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('debounced handlers are cancelled on stop', async () => {
      vi.useFakeTimers();
      await watcher.start();
      const fn = vi.fn();
      const debounced = watcher.callCreateDebouncedHandler(fn, 100);

      debounced();
      watcher.stop();
      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

  });
});

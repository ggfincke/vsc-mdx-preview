// packages/extension/test/BaseWatcher.test.ts
// tests for BaseWatcher abstract class lifecycle management

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseWatcher } from '../preview/watchers/BaseWatcher';

// concrete implementation for testing
class TestWatcher extends BaseWatcher {
  protected readonly logTag = 'TEST';
  public onStartCalled = false;
  public onStopCalled = false;
  public onDisposeCalled = false;
  public shouldAllowStart = true;
  public readinessCheck = true;

  protected canStart(): boolean {
    return this.shouldAllowStart;
  }

  protected checkReadiness(): boolean {
    return this.readinessCheck;
  }

  protected onStart(): void {
    this.onStartCalled = true;
  }

  protected onStop(): void {
    this.onStopCalled = true;
  }

  protected override onDispose(): void {
    this.onDisposeCalled = true;
  }

  // expose protected methods for testing
  public testDisposeWatcher(
    watcher: { dispose: () => void } | undefined
  ): void {
    this.disposeWatcher(watcher as any);
  }

  public testDisposeWatcherArray(watchers: { dispose: () => void }[]): void {
    this.disposeWatcherArray(watchers as any);
  }

  public testDisposeWatcherMap(
    watchers: Map<string, { dispose: () => void }>
  ): void {
    this.disposeWatcherMap(watchers as any);
  }

  public testDisposeAll(disposables: { dispose: () => void }[]): void {
    this.disposeAll(disposables as any);
  }
}

describe('BaseWatcher', () => {
  let watcher: TestWatcher;

  beforeEach(() => {
    watcher = new TestWatcher();
  });

  describe('start', () => {
    it('sets isActive to true', async () => {
      await watcher.start();

      expect(watcher.isActive()).toBe(true);
    });

    it('calls onStart', async () => {
      await watcher.start();

      expect(watcher.onStartCalled).toBe(true);
    });

    it('does nothing if already active', async () => {
      await watcher.start();
      watcher.onStartCalled = false;

      await watcher.start();

      expect(watcher.onStartCalled).toBe(false);
    });

    it('does not start if canStart returns false', async () => {
      watcher.shouldAllowStart = false;

      await watcher.start();

      expect(watcher.isActive()).toBe(false);
      expect(watcher.onStartCalled).toBe(false);
    });
  });

  describe('stop', () => {
    it('sets isActive to false', async () => {
      await watcher.start();

      watcher.stop();

      expect(watcher.isActive()).toBe(false);
    });

    it('calls onStop', async () => {
      await watcher.start();

      watcher.stop();

      expect(watcher.onStopCalled).toBe(true);
    });

    it('does nothing if not active', () => {
      watcher.stop();

      expect(watcher.onStopCalled).toBe(false);
    });
  });

  describe('isActive', () => {
    it('returns false initially', () => {
      expect(watcher.isActive()).toBe(false);
    });

    it('returns true after start', async () => {
      await watcher.start();

      expect(watcher.isActive()).toBe(true);
    });

    it('returns false after stop', async () => {
      await watcher.start();
      watcher.stop();

      expect(watcher.isActive()).toBe(false);
    });
  });

  describe('isReady', () => {
    it('returns false when not active', () => {
      expect(watcher.isReady()).toBe(false);
    });

    it('returns true when active and checkReadiness returns true', async () => {
      await watcher.start();

      expect(watcher.isReady()).toBe(true);
    });

    it('returns false when active but checkReadiness returns false', async () => {
      watcher.readinessCheck = false;
      await watcher.start();

      expect(watcher.isReady()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('calls stop', async () => {
      await watcher.start();

      watcher.dispose();

      expect(watcher.onStopCalled).toBe(true);
    });

    it('calls onDispose', async () => {
      await watcher.start();

      watcher.dispose();

      expect(watcher.onDisposeCalled).toBe(true);
    });

    it('can be called when not active', () => {
      watcher.dispose();

      expect(watcher.onDisposeCalled).toBe(true);
    });
  });

  describe('helper methods', () => {
    describe('disposeWatcher', () => {
      it('disposes a single watcher', () => {
        const mockWatcher = { dispose: vi.fn() };

        watcher.testDisposeWatcher(mockWatcher);

        expect(mockWatcher.dispose).toHaveBeenCalled();
      });

      it('handles undefined watcher', () => {
        expect(() => watcher.testDisposeWatcher(undefined)).not.toThrow();
      });
    });

    describe('disposeWatcherArray', () => {
      it('disposes all watchers in array', () => {
        const watchers = [
          { dispose: vi.fn() },
          { dispose: vi.fn() },
          { dispose: vi.fn() },
        ];

        watcher.testDisposeWatcherArray(watchers);

        watchers.forEach((w) => {
          expect(w.dispose).toHaveBeenCalled();
        });
      });

      it('clears the array', () => {
        const watchers = [{ dispose: vi.fn() }, { dispose: vi.fn() }];

        watcher.testDisposeWatcherArray(watchers);

        expect(watchers).toHaveLength(0);
      });
    });

    describe('disposeWatcherMap', () => {
      it('disposes all watchers in map', () => {
        const map = new Map([
          ['a', { dispose: vi.fn() }],
          ['b', { dispose: vi.fn() }],
        ]);

        watcher.testDisposeWatcherMap(map);

        for (const [, w] of map) {
          expect(w.dispose).toHaveBeenCalled();
        }
      });

      it('clears the map', () => {
        const map = new Map([['a', { dispose: vi.fn() }]]);

        watcher.testDisposeWatcherMap(map);

        expect(map.size).toBe(0);
      });
    });

    describe('disposeAll', () => {
      it('disposes all disposables', () => {
        const disposables = [{ dispose: vi.fn() }, { dispose: vi.fn() }];

        watcher.testDisposeAll(disposables);

        disposables.forEach((d) => {
          expect(d.dispose).toHaveBeenCalled();
        });
      });

      it('clears the array', () => {
        const disposables = [{ dispose: vi.fn() }];

        watcher.testDisposeAll(disposables);

        expect(disposables).toHaveLength(0);
      });
    });
  });
});

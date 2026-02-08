// tests/extension/preview/watchers/WatcherManager.test.ts
// unit tests for watcher coordination & lifecycle management

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../packages/extension/logging', () => ({
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

import { WatcherManager } from '../../../../packages/extension/preview/watchers/WatcherManager';
import type { IWatcher } from '../../../../packages/extension/types';

function createMockWatcher(opts?: {
  active?: boolean;
  ready?: boolean;
}): IWatcher & {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  isActive: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
  waitForReady: ReturnType<typeof vi.fn>;
} {
  const active = opts?.active ?? false;
  const ready = opts?.ready ?? true;
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    dispose: vi.fn(),
    isActive: vi.fn(() => active),
    isReady: vi.fn(() => ready),
    waitForReady: vi.fn(async () => {}),
  };
}

describe('WatcherManager', () => {
  let manager: WatcherManager;

  beforeEach(() => {
    manager = new WatcherManager();
  });

  // registration

  describe('registration', () => {
    it('register + has returns true', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);
      expect(manager.has('test')).toBe(true);
    });

    it('register same name disposes old first', () => {
      const old = createMockWatcher();
      const next = createMockWatcher();
      manager.register('test', old);
      manager.register('test', next);
      expect(old.dispose).toHaveBeenCalled();
      expect(manager.get('test')).toBe(next);
    });

    it('get returns typed watcher', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);
      expect(manager.get('test')).toBe(watcher);
    });

    it('get returns undefined for non-existent', () => {
      expect(manager.get('nope')).toBeUndefined();
    });

    it('unregister disposes & returns true', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);
      const result = manager.unregister('test');
      expect(result).toBe(true);
      expect(watcher.dispose).toHaveBeenCalled();
      expect(manager.has('test')).toBe(false);
    });

    it('unregister non-existent returns false', () => {
      expect(manager.unregister('nope')).toBe(false);
    });

    it('getNames returns all registered names', () => {
      manager.register('a', createMockWatcher());
      manager.register('b', createMockWatcher());
      expect(manager.getNames()).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('size returns count', () => {
      expect(manager.size).toBe(0);
      manager.register('a', createMockWatcher());
      manager.register('b', createMockWatcher());
      expect(manager.size).toBe(2);
    });
  });

  // lifecycle

  describe('lifecycle', () => {
    it('startAll starts all non-active watchers', async () => {
      const w1 = createMockWatcher({ active: false });
      const w2 = createMockWatcher({ active: true });
      manager.register('w1', w1);
      manager.register('w2', w2);
      await manager.startAll();
      expect(w1.start).toHaveBeenCalled();
      expect(w2.start).not.toHaveBeenCalled();
    });

    it('stopAll stops all active watchers', () => {
      const w1 = createMockWatcher({ active: true });
      const w2 = createMockWatcher({ active: false });
      manager.register('w1', w1);
      manager.register('w2', w2);
      manager.stopAll();
      expect(w1.stop).toHaveBeenCalled();
      expect(w2.stop).not.toHaveBeenCalled();
    });

    it('refreshAll stops & starts each active watcher', async () => {
      const w1 = createMockWatcher({ active: true });
      const w2 = createMockWatcher({ active: false });
      manager.register('w1', w1);
      manager.register('w2', w2);
      await manager.refreshAll();
      expect(w1.stop).toHaveBeenCalled();
      expect(w1.start).toHaveBeenCalled();
      expect(w2.stop).not.toHaveBeenCalled();
      expect(w2.start).not.toHaveBeenCalled();
    });

    it('refresh(name) stops & starts a single watcher', async () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);
      await manager.refresh('test');
      expect(watcher.stop).toHaveBeenCalled();
      expect(watcher.start).toHaveBeenCalled();
    });
  });

  // ready state

  describe('ready state', () => {
    it('waitForAllReady resolves when all ready', async () => {
      const w1 = createMockWatcher({ ready: true });
      const w2 = createMockWatcher({ ready: true });
      manager.register('w1', w1);
      manager.register('w2', w2);
      await manager.waitForAllReady();
      expect(w1.waitForReady).toHaveBeenCalled();
      expect(w2.waitForReady).toHaveBeenCalled();
    });

    it('getReadyState returns Map of name → boolean', () => {
      const w1 = createMockWatcher({ ready: true });
      const w2 = createMockWatcher({ ready: false });
      manager.register('w1', w1);
      manager.register('w2', w2);
      const state = manager.getReadyState();
      expect(state.get('w1')).toBe(true);
      expect(state.get('w2')).toBe(false);
    });

    it('areAllReady returns true when all ready', () => {
      manager.register('w1', createMockWatcher({ ready: true }));
      manager.register('w2', createMockWatcher({ ready: true }));
      expect(manager.areAllReady()).toBe(true);
    });

    it('areAllReady returns false when not all ready', () => {
      manager.register('w1', createMockWatcher({ ready: true }));
      manager.register('w2', createMockWatcher({ ready: false }));
      expect(manager.areAllReady()).toBe(false);
    });

    it('areAllReady returns true for empty manager', () => {
      expect(manager.areAllReady()).toBe(true);
    });
  });

  // ready gate

  describe('ready gate', () => {
    it('waitForGate resolves after gate', async () => {
      let resolveGate: () => void;
      const gate = new Promise<void>((resolve) => {
        resolveGate = resolve;
      });
      manager.setReadyGate(gate);

      let resolved = false;
      const waitPromise = manager.waitForGate().then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      resolveGate!();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('waitForGate resolves immediately w/ no gate', async () => {
      await manager.waitForGate();
    });
  });

  // dispose

  describe('dispose', () => {
    it('disposes all watchers & clears map', () => {
      const w1 = createMockWatcher();
      const w2 = createMockWatcher();
      manager.register('w1', w1);
      manager.register('w2', w2);
      manager.dispose();
      expect(w1.dispose).toHaveBeenCalled();
      expect(w2.dispose).toHaveBeenCalled();
      expect(manager.size).toBe(0);
    });
  });
});

// packages/extension/test/WatcherManager.test.ts
// unit tests for WatcherManager

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WatcherManager } from '../preview/watchers/WatcherManager';
import type { IWatcher } from '../preview/watchers/types';

// Create a mock watcher that implements IWatcher interface
const createMockWatcher = (options?: {
  isReady?: boolean;
  isActive?: boolean;
}): IWatcher => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  dispose: vi.fn(),
  isActive: vi.fn().mockReturnValue(options?.isActive ?? false),
  isReady: vi.fn().mockReturnValue(options?.isReady ?? true),
});

describe('WatcherManager', () => {
  let manager: WatcherManager;

  beforeEach(() => {
    manager = new WatcherManager();
  });

  describe('register()', () => {
    it('registers a watcher with unique name', () => {
      const watcher = createMockWatcher();

      manager.register('test', watcher);

      expect(manager.has('test')).toBe(true);
      expect(manager.size).toBe(1);
    });

    it('replaces existing watcher with same name', () => {
      const watcher1 = createMockWatcher();
      const watcher2 = createMockWatcher();

      manager.register('test', watcher1);
      manager.register('test', watcher2);

      expect(manager.size).toBe(1);
      expect(manager.get('test')).toBe(watcher2);
    });

    it('disposes previous watcher when replacing', () => {
      const watcher1 = createMockWatcher();
      const watcher2 = createMockWatcher();

      manager.register('test', watcher1);
      manager.register('test', watcher2);

      expect(watcher1.dispose).toHaveBeenCalledOnce();
      expect(watcher2.dispose).not.toHaveBeenCalled();
    });

    it('can register multiple watchers with different names', () => {
      const watcher1 = createMockWatcher();
      const watcher2 = createMockWatcher();
      const watcher3 = createMockWatcher();

      manager.register('one', watcher1);
      manager.register('two', watcher2);
      manager.register('three', watcher3);

      expect(manager.size).toBe(3);
      expect(manager.has('one')).toBe(true);
      expect(manager.has('two')).toBe(true);
      expect(manager.has('three')).toBe(true);
    });
  });

  describe('get()', () => {
    it('returns registered watcher by name', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);

      expect(manager.get('test')).toBe(watcher);
    });

    it('returns undefined for unknown watcher', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('preserves watcher type with generic', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);

      const retrieved = manager.get<IWatcher>('test');
      expect(retrieved).toBe(watcher);
    });
  });

  describe('has()', () => {
    it('returns true for existing watcher', () => {
      manager.register('test', createMockWatcher());

      expect(manager.has('test')).toBe(true);
    });

    it('returns false for non-existent watcher', () => {
      expect(manager.has('nonexistent')).toBe(false);
    });
  });

  describe('unregister()', () => {
    it('removes and disposes watcher', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);

      const result = manager.unregister('test');

      expect(result).toBe(true);
      expect(manager.has('test')).toBe(false);
      expect(watcher.dispose).toHaveBeenCalledOnce();
    });

    it('returns true on successful removal', () => {
      manager.register('test', createMockWatcher());

      expect(manager.unregister('test')).toBe(true);
    });

    it('returns false for non-existent watcher', () => {
      expect(manager.unregister('nonexistent')).toBe(false);
    });

    it('does not affect other watchers', () => {
      manager.register('one', createMockWatcher());
      manager.register('two', createMockWatcher());

      manager.unregister('one');

      expect(manager.has('one')).toBe(false);
      expect(manager.has('two')).toBe(true);
      expect(manager.size).toBe(1);
    });
  });

  describe('startAll()', () => {
    it('starts all inactive watchers', async () => {
      const watcher1 = createMockWatcher({ isActive: false });
      const watcher2 = createMockWatcher({ isActive: false });

      manager.register('one', watcher1);
      manager.register('two', watcher2);

      await manager.startAll();

      expect(watcher1.start).toHaveBeenCalledOnce();
      expect(watcher2.start).toHaveBeenCalledOnce();
    });

    it('skips already active watchers', async () => {
      const activeWatcher = createMockWatcher({ isActive: true });
      const inactiveWatcher = createMockWatcher({ isActive: false });

      manager.register('active', activeWatcher);
      manager.register('inactive', inactiveWatcher);

      await manager.startAll();

      expect(activeWatcher.start).not.toHaveBeenCalled();
      expect(inactiveWatcher.start).toHaveBeenCalledOnce();
    });

    it('waits for all promises to resolve', async () => {
      let resolved1 = false;
      let resolved2 = false;

      const watcher1 = createMockWatcher();
      vi.mocked(watcher1.start).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        resolved1 = true;
      });

      const watcher2 = createMockWatcher();
      vi.mocked(watcher2.start).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5));
        resolved2 = true;
      });

      manager.register('one', watcher1);
      manager.register('two', watcher2);

      await manager.startAll();

      expect(resolved1).toBe(true);
      expect(resolved2).toBe(true);
    });

    it('handles no watchers registered', async () => {
      await expect(manager.startAll()).resolves.toBeUndefined();
    });

    it('handles all watchers already active', async () => {
      const watcher = createMockWatcher({ isActive: true });
      manager.register('test', watcher);

      await manager.startAll();

      expect(watcher.start).not.toHaveBeenCalled();
    });
  });

  describe('waitForAllReady()', () => {
    it('resolves immediately when all watchers are ready', async () => {
      const watcher1 = createMockWatcher({ isReady: true });
      const watcher2 = createMockWatcher({ isReady: true });

      manager.register('one', watcher1);
      manager.register('two', watcher2);

      await expect(manager.waitForAllReady()).resolves.toBeUndefined();
    });

    it('polls watchers until ready', async () => {
      let callCount = 0;
      const watcher = createMockWatcher();
      vi.mocked(watcher.isReady).mockImplementation(() => {
        callCount++;
        return callCount >= 3; // Becomes ready after 3 calls
      });

      manager.register('test', watcher);

      await manager.waitForAllReady();

      expect(watcher.isReady).toHaveBeenCalled();
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('handles watchers already ready', async () => {
      const watcher = createMockWatcher({ isReady: true });
      manager.register('test', watcher);

      await manager.waitForAllReady();

      expect(watcher.isReady).toHaveBeenCalled();
    });

    it('handles no watchers registered', async () => {
      await expect(manager.waitForAllReady()).resolves.toBeUndefined();
    });
  });

  describe('getReadyState()', () => {
    it('returns map of watcher names to ready state', () => {
      const readyWatcher = createMockWatcher({ isReady: true });
      const notReadyWatcher = createMockWatcher({ isReady: false });

      manager.register('ready', readyWatcher);
      manager.register('notReady', notReadyWatcher);

      const readyState = manager.getReadyState();

      expect(readyState.get('ready')).toBe(true);
      expect(readyState.get('notReady')).toBe(false);
    });

    it('reflects current ready state of each watcher', () => {
      const watcher = createMockWatcher({ isReady: false });
      manager.register('test', watcher);

      expect(manager.getReadyState().get('test')).toBe(false);

      vi.mocked(watcher.isReady).mockReturnValue(true);

      expect(manager.getReadyState().get('test')).toBe(true);
    });

    it('returns empty map when no watchers', () => {
      const readyState = manager.getReadyState();

      expect(readyState.size).toBe(0);
    });
  });

  describe('setReadyGate() / waitForGate()', () => {
    it('setReadyGate stores promise', async () => {
      const gate = Promise.resolve();
      manager.setReadyGate(gate);

      // No direct way to verify, but waitForGate should use it
      await expect(manager.waitForGate()).resolves.toBeUndefined();
    });

    it('waitForGate resolves immediately if no gate set', async () => {
      await expect(manager.waitForGate()).resolves.toBeUndefined();
    });

    it('waitForGate waits for gate promise to resolve', async () => {
      let gateResolved = false;
      let gateResolve: () => void;
      const gate = new Promise<void>((resolve) => {
        gateResolve = () => {
          gateResolved = true;
          resolve();
        };
      });

      manager.setReadyGate(gate);

      const waitPromise = manager.waitForGate();

      // Gate not resolved yet
      expect(gateResolved).toBe(false);

      // Resolve the gate
      gateResolve!();

      await waitPromise;
      expect(gateResolved).toBe(true);
    });

    it('multiple waitForGate calls share same gate', async () => {
      let resolveCount = 0;
      let gateResolve: () => void;
      const gate = new Promise<void>((resolve) => {
        gateResolve = resolve;
      });

      manager.setReadyGate(gate);

      const wait1 = manager.waitForGate().then(() => resolveCount++);
      const wait2 = manager.waitForGate().then(() => resolveCount++);
      const wait3 = manager.waitForGate().then(() => resolveCount++);

      gateResolve!();

      await Promise.all([wait1, wait2, wait3]);
      expect(resolveCount).toBe(3);
    });
  });

  describe('stopAll()', () => {
    it('stops all active watchers', () => {
      const watcher1 = createMockWatcher({ isActive: true });
      const watcher2 = createMockWatcher({ isActive: true });

      manager.register('one', watcher1);
      manager.register('two', watcher2);

      manager.stopAll();

      expect(watcher1.stop).toHaveBeenCalledOnce();
      expect(watcher2.stop).toHaveBeenCalledOnce();
    });

    it('does not dispose watchers', () => {
      const watcher = createMockWatcher({ isActive: true });
      manager.register('test', watcher);

      manager.stopAll();

      expect(watcher.dispose).not.toHaveBeenCalled();
    });

    it('skips inactive watchers', () => {
      const inactiveWatcher = createMockWatcher({ isActive: false });
      manager.register('inactive', inactiveWatcher);

      manager.stopAll();

      expect(inactiveWatcher.stop).not.toHaveBeenCalled();
    });

    it('allows watchers to be restarted', async () => {
      const watcher = createMockWatcher({ isActive: true });
      manager.register('test', watcher);

      manager.stopAll();

      // After stop, watcher is inactive
      vi.mocked(watcher.isActive).mockReturnValue(false);

      await manager.startAll();

      expect(watcher.start).toHaveBeenCalledOnce();
    });
  });

  describe('getNames() / size', () => {
    it('returns all registered names', () => {
      manager.register('alpha', createMockWatcher());
      manager.register('beta', createMockWatcher());
      manager.register('gamma', createMockWatcher());

      const names = manager.getNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('alpha');
      expect(names).toContain('beta');
      expect(names).toContain('gamma');
    });

    it('size property reflects count', () => {
      expect(manager.size).toBe(0);

      manager.register('one', createMockWatcher());
      expect(manager.size).toBe(1);

      manager.register('two', createMockWatcher());
      expect(manager.size).toBe(2);

      manager.unregister('one');
      expect(manager.size).toBe(1);
    });

    it('returns empty array when no watchers', () => {
      expect(manager.getNames()).toEqual([]);
    });
  });

  describe('dispose()', () => {
    it('disposes all watchers', () => {
      const watcher1 = createMockWatcher();
      const watcher2 = createMockWatcher();
      const watcher3 = createMockWatcher();

      manager.register('one', watcher1);
      manager.register('two', watcher2);
      manager.register('three', watcher3);

      manager.dispose();

      expect(watcher1.dispose).toHaveBeenCalledOnce();
      expect(watcher2.dispose).toHaveBeenCalledOnce();
      expect(watcher3.dispose).toHaveBeenCalledOnce();
    });

    it('clears the registry', () => {
      manager.register('test', createMockWatcher());

      manager.dispose();

      expect(manager.size).toBe(0);
      expect(manager.has('test')).toBe(false);
    });

    it('can be called on empty manager', () => {
      expect(() => manager.dispose()).not.toThrow();
    });

    it('handles multiple dispose calls gracefully', () => {
      const watcher = createMockWatcher();
      manager.register('test', watcher);

      manager.dispose();
      manager.dispose(); // Second call should not throw

      expect(watcher.dispose).toHaveBeenCalledOnce();
    });
  });
});

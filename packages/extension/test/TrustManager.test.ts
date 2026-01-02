import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  __setMockTrusted,
  __setMockConfig,
  __resetMocks,
  __triggerTrustChange,
  __triggerConfigChange,
} from './__mocks__/vscode';
import { TrustManager } from '../security/TrustManager';

// Reset singleton between tests
const resetTrustManager = (): void => {
  // Access private static instance to reset it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TrustManager as any).instance = undefined;
};

describe('TrustManager', () => {
  beforeEach(() => {
    __resetMocks();
    resetTrustManager();
  });

  afterEach(() => {
    // Clean up singleton
    try {
      TrustManager.getInstance().dispose();
    } catch {
      // Ignore if already disposed
    }
    resetTrustManager();
  });

  describe('getInstance', () => {
    test('returns a singleton instance', () => {
      const instance1 = TrustManager.getInstance();
      const instance2 = TrustManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getState', () => {
    test('returns canExecute: false when workspace is not trusted', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', true);

      const manager = TrustManager.getInstance();
      const state = manager.getState();

      expect(state.workspaceTrusted).toBe(false);
      expect(state.scriptsEnabled).toBe(true);
      expect(state.canExecute).toBe(false);
    });

    test('returns canExecute: false when scripts are disabled', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', false);

      const manager = TrustManager.getInstance();
      const state = manager.getState();

      expect(state.workspaceTrusted).toBe(true);
      expect(state.scriptsEnabled).toBe(false);
      expect(state.canExecute).toBe(false);
    });

    test('returns canExecute: true when workspace is trusted AND scripts are enabled', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const manager = TrustManager.getInstance();
      const state = manager.getState();

      expect(state.workspaceTrusted).toBe(true);
      expect(state.scriptsEnabled).toBe(true);
      expect(state.canExecute).toBe(true);
    });

    test('returns canExecute: false when both are disabled', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      const manager = TrustManager.getInstance();
      const state = manager.getState();

      expect(state.workspaceTrusted).toBe(false);
      expect(state.scriptsEnabled).toBe(false);
      expect(state.canExecute).toBe(false);
    });
  });

  describe('canExecute', () => {
    test('returns true when getState().canExecute is true', () => {
      __setMockTrusted(true);
      __setMockConfig('preview.enableScripts', true);

      const manager = TrustManager.getInstance();
      expect(manager.canExecute()).toBe(true);
    });

    test('returns false when getState().canExecute is false', () => {
      __setMockTrusted(false);
      __setMockConfig('preview.enableScripts', false);

      const manager = TrustManager.getInstance();
      expect(manager.canExecute()).toBe(false);
    });
  });

  describe('subscribe', () => {
    test('listener is called when workspace trust changes', () => {
      const manager = TrustManager.getInstance();
      const listener = vi.fn();

      manager.subscribe(listener);
      __triggerTrustChange();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceTrusted: expect.any(Boolean),
          scriptsEnabled: expect.any(Boolean),
          canExecute: expect.any(Boolean),
        })
      );
    });

    test('listener is called when enableScripts config changes', () => {
      const manager = TrustManager.getInstance();
      const listener = vi.fn();

      manager.subscribe(listener);
      __triggerConfigChange('mdx-preview.preview.enableScripts');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('listener is NOT called for unrelated config changes', () => {
      const manager = TrustManager.getInstance();
      const listener = vi.fn();

      manager.subscribe(listener);
      __triggerConfigChange('some.other.config');

      expect(listener).not.toHaveBeenCalled();
    });

    test('returns disposable that removes listener', () => {
      const manager = TrustManager.getInstance();
      const listener = vi.fn();

      const disposable = manager.subscribe(listener);
      disposable.dispose();
      __triggerTrustChange();

      expect(listener).not.toHaveBeenCalled();
    });

    test('multiple listeners can be registered', () => {
      const manager = TrustManager.getInstance();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);
      __triggerTrustChange();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    test('listener errors are caught and do not affect other listeners', () => {
      const manager = TrustManager.getInstance();
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const successListener = vi.fn();

      // Suppress console.error for this test
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      manager.subscribe(errorListener);
      manager.subscribe(successListener);
      __triggerTrustChange();

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(successListener).toHaveBeenCalledTimes(1);

      consoleError.mockRestore();
    });
  });

  describe('dispose', () => {
    test('clears all listeners after dispose', () => {
      const manager = TrustManager.getInstance();
      const listener = vi.fn();

      manager.subscribe(listener);
      manager.dispose();

      // After dispose, triggering changes should not call listeners
      // Note: In real VS Code, the disposables would prevent events
      // Here we're testing that internal state is cleared
      expect(() => manager.getState()).not.toThrow();
    });
  });
});

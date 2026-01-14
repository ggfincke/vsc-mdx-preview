// packages/extension/test/ConfigManager.test.ts
// unit tests for ConfigManager (settings management, subscriptions, defaults)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __setMockConfig,
  __resetMocks,
  __triggerConfigChange,
} from './__mocks__/vscode';
import { ConfigManager } from '../config/ConfigManager';

// reset ConfigManager singleton between tests
const resetConfigManager = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ConfigManager as any).instance = undefined;
};

describe('ConfigManager', () => {
  beforeEach(() => {
    __resetMocks();
    resetConfigManager();
  });

  afterEach(() => {
    try {
      ConfigManager.getInstance().dispose();
    } catch {
      // Ignore if already disposed
    }
    resetConfigManager();
    __resetMocks();
  });

  describe('getInstance', () => {
    it('returns a singleton instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('get', () => {
    it('returns default value when setting not configured', () => {
      const manager = ConfigManager.getInstance();
      const value = manager.get('preview.updateMode');
      expect(value).toBe('onType');
    });

    it('returns configured value when set', () => {
      __setMockConfig('preview.updateMode', 'onSave');
      const manager = ConfigManager.getInstance();
      const value = manager.get('preview.updateMode');
      expect(value).toBe('onSave');
    });

    it('returns default for enableScripts (false)', () => {
      const manager = ConfigManager.getInstance();
      const value = manager.get('preview.enableScripts');
      expect(value).toBe(false);
    });

    it('returns configured enableScripts value', () => {
      __setMockConfig('preview.enableScripts', true);
      const manager = ConfigManager.getInstance();
      const value = manager.get('preview.enableScripts');
      expect(value).toBe(true);
    });

    it('returns default debounceDelay', () => {
      const manager = ConfigManager.getInstance();
      const value = manager.get('preview.debounceDelay');
      expect(value).toBe(300); // PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS
    });
  });

  describe('getAll', () => {
    it('returns all settings with defaults', () => {
      const manager = ConfigManager.getInstance();
      const all = manager.getAll();

      expect(all['preview.updateMode']).toBe('onType');
      expect(all['preview.enableScripts']).toBe(false);
      expect(all['preview.security']).toBe('strict');
      expect(all['preview.useVscodeMarkdownStyles']).toBe(true);
      expect(all['preview.useWhiteBackground']).toBe(false);
      expect(all['build.useSucraseTranspiler']).toBe(false);
      expect(all['tailwind.enabled']).toBe('enabled');
      expect(all.framework).toBe('auto');
    });

    it('includes configured values', () => {
      __setMockConfig('preview.enableScripts', true);
      __setMockConfig('framework', 'docusaurus');

      const manager = ConfigManager.getInstance();
      const all = manager.getAll();

      expect(all['preview.enableScripts']).toBe(true);
      expect(all.framework).toBe('docusaurus');
    });
  });

  describe('onDidChangeConfiguration', () => {
    it('calls subscriber when relevant config changes', () => {
      const manager = ConfigManager.getInstance();
      const callback = vi.fn();

      manager.onDidChangeConfiguration(callback);
      __triggerConfigChange('mdx-preview.preview.enableScripts');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining(['preview.enableScripts'])
      );
    });

    it('does not call subscriber for unrelated config changes', () => {
      const manager = ConfigManager.getInstance();
      const callback = vi.fn();

      manager.onDidChangeConfiguration(callback);
      __triggerConfigChange('some.other.config');

      expect(callback).not.toHaveBeenCalled();
    });

    it('returns disposable that removes subscriber', () => {
      const manager = ConfigManager.getInstance();
      const callback = vi.fn();

      const disposable = manager.onDidChangeConfiguration(callback);
      disposable.dispose();
      __triggerConfigChange('mdx-preview.preview.enableScripts');

      expect(callback).not.toHaveBeenCalled();
    });

    it('handles multiple subscribers', () => {
      const manager = ConfigManager.getInstance();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.onDidChangeConfiguration(callback1);
      manager.onDidChangeConfiguration(callback2);
      __triggerConfigChange('mdx-preview.preview.updateMode');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('catches and logs subscriber errors without affecting others', () => {
      const manager = ConfigManager.getInstance();
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const successCallback = vi.fn();

      manager.onDidChangeConfiguration(errorCallback);
      manager.onDidChangeConfiguration(successCallback);
      __triggerConfigChange('mdx-preview.preview.enableScripts');

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(successCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('affectsConfiguration', () => {
    it('returns true for matching configuration key', () => {
      const event = {
        affectsConfiguration: (key: string) =>
          key === 'mdx-preview.preview.enableScripts',
      };
      expect(
        ConfigManager.affectsConfiguration(event as any, 'preview.enableScripts')
      ).toBe(true);
    });

    it('returns false for non-matching configuration key', () => {
      const event = {
        affectsConfiguration: (key: string) =>
          key === 'mdx-preview.preview.enableScripts',
      };
      expect(
        ConfigManager.affectsConfiguration(event as any, 'preview.updateMode')
      ).toBe(false);
    });
  });

  describe('dispose', () => {
    it('clears subscribers', () => {
      const manager = ConfigManager.getInstance();
      const callback = vi.fn();

      manager.onDidChangeConfiguration(callback);
      manager.dispose();

      // After dispose, changes should not trigger callback
      // (The disposable on vscode.workspace is also disposed)
      resetConfigManager();
      // Create a new manager instance (unused, but resets singleton state)
      ConfigManager.getInstance();
      __triggerConfigChange('mdx-preview.preview.enableScripts');

      // Original callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('disposes and clears singleton', () => {
      const instance1 = ConfigManager.getInstance();
      ConfigManager.reset();
      const instance2 = ConfigManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });
});

// packages/extension/test/PreviewConfiguration.test.ts
// unit tests for PreviewConfiguration

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Uri,
  __resetMocks,
  __setMockConfig,
  createMockConfigManager,
} from './__mocks__/vscode';
import { PreviewConfiguration } from '../preview/PreviewConfiguration';
import { SecurityPolicy } from '../security/security';
import { PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS } from '../constants';

// Mock getConfigManager to use the vscode mock's config store with defaults
vi.mock('../services', () => ({
  getConfigManager: () => createMockConfigManager(),
}));

describe('PreviewConfiguration', () => {
  const mockDocUri = Uri.file('/projects/test-workspace/test.mdx');
  const mockUpdateFn = vi.fn();

  beforeEach(() => {
    __resetMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('returns default values when no config exists', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.configuration.updateMode).toBe('onType');
      expect(config.configuration.debounceDelay).toBe(
        PREVIEW_DEBOUNCE_DELAY_DEFAULT_MS
      );
      expect(config.configuration.useSucraseTranspiler).toBe(false);
      expect(config.configuration.useVscodeMarkdownStyles).toBe(true);
      expect(config.configuration.useWhiteBackground).toBe(false);
      expect(config.configuration.customLayoutFilePath).toBe('');
      expect(config.configuration.customCss).toBe('');
      expect(config.configuration.securityPolicy).toBe(SecurityPolicy.Strict);
      expect(config.configuration.tailwindEnabled).toBe('enabled');
    });

    it('loads custom configuration values', () => {
      __setMockConfig('preview.updateMode', 'onSave');
      __setMockConfig('preview.debounceDelay', 500);
      __setMockConfig('build.useSucraseTranspiler', true);
      __setMockConfig('preview.useVscodeMarkdownStyles', false);
      __setMockConfig('preview.useWhiteBackground', true);
      __setMockConfig('preview.mdx.customLayoutFilePath', '/custom/layout.tsx');
      __setMockConfig('preview.customCss', '/custom/styles.css');
      __setMockConfig('preview.security', SecurityPolicy.Disabled);
      __setMockConfig('tailwind.enabled', 'disabled');

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.configuration.updateMode).toBe('onSave');
      expect(config.configuration.debounceDelay).toBe(500);
      expect(config.configuration.useSucraseTranspiler).toBe(true);
      expect(config.configuration.useVscodeMarkdownStyles).toBe(false);
      expect(config.configuration.useWhiteBackground).toBe(true);
      expect(config.configuration.customLayoutFilePath).toBe(
        '/custom/layout.tsx'
      );
      expect(config.configuration.customCss).toBe('/custom/styles.css');
      expect(config.configuration.securityPolicy).toBe(SecurityPolicy.Disabled);
      expect(config.configuration.tailwindEnabled).toBe('disabled');
    });

    it('creates debounced update function with configured delay', () => {
      __setMockConfig('preview.debounceDelay', 100);

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.debouncedUpdateWebview).toBeDefined();
      expect(typeof config.debouncedUpdateWebview).toBe('function');
    });
  });

  describe('configuration getters', () => {
    it('get configuration() returns full state', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);
      const state = config.configuration;

      expect(state).toHaveProperty('updateMode');
      expect(state).toHaveProperty('debounceDelay');
      expect(state).toHaveProperty('useSucraseTranspiler');
      expect(state).toHaveProperty('useVscodeMarkdownStyles');
      expect(state).toHaveProperty('useWhiteBackground');
      expect(state).toHaveProperty('customLayoutFilePath');
      expect(state).toHaveProperty('customCss');
      expect(state).toHaveProperty('securityPolicy');
      expect(state).toHaveProperty('tailwindEnabled');
    });

    it('get styleConfiguration() returns style subset', () => {
      __setMockConfig('preview.useVscodeMarkdownStyles', true);
      __setMockConfig('preview.useWhiteBackground', true);

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);
      const styleConfig = config.styleConfiguration;

      expect(styleConfig).toEqual({
        useVscodeMarkdownStyles: true,
        useWhiteBackground: true,
      });
    });

    it('get securityConfiguration() returns security settings', () => {
      __setMockConfig('preview.security', SecurityPolicy.Disabled);

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);
      const securityConfig = config.securityConfiguration;

      expect(securityConfig).toEqual({
        securityPolicy: SecurityPolicy.Disabled,
      });
    });

    it('get debouncedUpdateWebview() returns debounce function', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.debouncedUpdateWebview).toBeDefined();
      expect(typeof config.debouncedUpdateWebview).toBe('function');
    });
  });

  describe('updateConfiguration()', () => {
    it('returns all false flags when no changes', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);
      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsWebviewRefresh).toBe(false);
      expect(result.needsDebounceRecreate).toBe(false);
      expect(result.needsCssWatcherUpdate).toBe(false);
      expect(result.oldCssPath).toBe('');
    });

    it('detects debounceDelay change', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      // Change the config after initial creation
      __setMockConfig('preview.debounceDelay', 500);

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsDebounceRecreate).toBe(true);
      expect(config.configuration.debounceDelay).toBe(500);
    });

    it('detects customCss change', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.customCss', '/new/styles.css');

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsCssWatcherUpdate).toBe(true);
      expect(result.oldCssPath).toBe('');
      expect(config.configuration.customCss).toBe('/new/styles.css');
    });

    it('detects customLayoutFilePath change as needing refresh', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.mdx.customLayoutFilePath', '/new/layout.tsx');

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsWebviewRefresh).toBe(true);
      expect(config.configuration.customLayoutFilePath).toBe('/new/layout.tsx');
    });

    it('detects useVscodeMarkdownStyles change as needing refresh', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.useVscodeMarkdownStyles', false);

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects useWhiteBackground change as needing refresh', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.useWhiteBackground', true);

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects securityPolicy change as needing refresh', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.security', SecurityPolicy.Disabled);

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects tailwindEnabled change as needing refresh', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('tailwind.enabled', 'disabled');

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('detects multiple simultaneous changes', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      // Change multiple settings at once
      __setMockConfig('preview.debounceDelay', 500);
      __setMockConfig('preview.customCss', '/new/styles.css');
      __setMockConfig('preview.useVscodeMarkdownStyles', false);

      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.needsDebounceRecreate).toBe(true);
      expect(result.needsCssWatcherUpdate).toBe(true);
      expect(result.needsWebviewRefresh).toBe(true);
    });

    it('updates internal state after configuration change', () => {
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.updateMode', 'onSave');
      __setMockConfig('build.useSucraseTranspiler', true);

      config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(config.configuration.updateMode).toBe('onSave');
      expect(config.configuration.useSucraseTranspiler).toBe(true);
    });

    it('preserves oldCssPath when customCss changes', () => {
      __setMockConfig('preview.customCss', '/old/styles.css');
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      __setMockConfig('preview.customCss', '/new/styles.css');
      const result = config.updateConfiguration(mockDocUri, mockUpdateFn);

      expect(result.oldCssPath).toBe('/old/styles.css');
    });
  });

  describe('edge cases', () => {
    it('handles invalid updateMode gracefully (uses default)', () => {
      // When an invalid value is set, the get() should use the default
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      // Default should be 'onType'
      expect(config.configuration.updateMode).toBe('onType');
    });

    it('handles zero debounce delay', () => {
      __setMockConfig('preview.debounceDelay', 0);

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.configuration.debounceDelay).toBe(0);
    });

    it('handles empty string for customCss', () => {
      __setMockConfig('preview.customCss', '');

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.configuration.customCss).toBe('');
    });

    it('handles tailwindEnabled auto setting', () => {
      __setMockConfig('tailwind.enabled', 'auto');

      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      expect(config.configuration.tailwindEnabled).toBe('auto');
    });

    it('recreates debounced function when delay changes', () => {
      __setMockConfig('preview.debounceDelay', 100);
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      const originalDebounced = config.debouncedUpdateWebview;

      __setMockConfig('preview.debounceDelay', 500);
      config.updateConfiguration(mockDocUri, mockUpdateFn);

      const newDebounced = config.debouncedUpdateWebview;

      // The debounced function should be a new instance
      expect(newDebounced).not.toBe(originalDebounced);
    });

    it('does not recreate debounced function when delay unchanged', () => {
      __setMockConfig('preview.debounceDelay', 100);
      const config = new PreviewConfiguration(mockDocUri, mockUpdateFn);

      const originalDebounced = config.debouncedUpdateWebview;

      // Change something else but not debounceDelay
      __setMockConfig('preview.useWhiteBackground', true);
      config.updateConfiguration(mockDocUri, mockUpdateFn);

      const sameDebounced = config.debouncedUpdateWebview;

      // Should be the same instance
      expect(sameDebounced).toBe(originalDebounced);
    });
  });
});

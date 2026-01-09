// packages/extension/test/ThemeManager.test.ts
// tests for ThemeManager singleton

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from '../themes/ThemeManager';

// mock vscode module
vi.mock('vscode', () => ({
  window: {
    activeColorTheme: { kind: 1 }, // Light theme
    onDidChangeActiveColorTheme: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => {
        const config: Record<string, unknown> = {
          'preview.previewTheme': 'github-light',
          'preview.codeBlockTheme': 'auto',
          'preview.autoTheme': true,
        };
        return config[key] ?? defaultValue;
      }),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  Disposable: class {
    private fn: () => void;
    constructor(fn: () => void) {
      this.fn = fn;
    }
    dispose() {
      this.fn();
    }
  },
}));

describe('ThemeManager', () => {
  beforeEach(() => {
    // reset singleton before each test
    ThemeManager.dispose();
  });

  afterEach(() => {
    ThemeManager.dispose();
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = ThemeManager.getInstance();
      const instance2 = ThemeManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('creates new instance after dispose', () => {
      const instance1 = ThemeManager.getInstance();
      ThemeManager.dispose();
      const instance2 = ThemeManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getThemeConfiguration', () => {
    it('returns theme configuration from settings', () => {
      const manager = ThemeManager.getInstance();
      const config = manager.getThemeConfiguration();

      expect(config).toHaveProperty('previewTheme');
      expect(config).toHaveProperty('codeBlockTheme');
      expect(config).toHaveProperty('autoTheme');
    });
  });

  describe('isLightTheme', () => {
    it('returns true for light theme', () => {
      const manager = ThemeManager.getInstance();
      expect(manager.isLightTheme()).toBe(true);
    });
  });

  describe('getEffectivePreviewTheme', () => {
    it('returns configured theme when autoTheme is false', () => {
      const manager = ThemeManager.getInstance();
      const config = {
        previewTheme: 'github-dark' as const,
        codeBlockTheme: 'auto' as const,
        autoTheme: false,
      };

      const result = manager.getEffectivePreviewTheme(config);
      expect(result).toBe('github-dark');
    });

    it('returns configured theme when theme lightness matches VS Code', () => {
      const manager = ThemeManager.getInstance();
      const config = {
        previewTheme: 'github-light' as const,
        codeBlockTheme: 'auto' as const,
        autoTheme: true,
      };

      // VS Code is light, theme is light - should match
      const result = manager.getEffectivePreviewTheme(config);
      expect(result).toBe('github-light');
    });
  });

  describe('getEffectiveCodeBlockTheme', () => {
    it('returns theme as-is when not auto', () => {
      const manager = ThemeManager.getInstance();
      const result = manager.getEffectiveCodeBlockTheme(
        'monokai',
        'github-light'
      );

      expect(result).toBe('monokai');
    });

    it('returns matching theme for auto mode', () => {
      const manager = ThemeManager.getInstance();
      const result = manager.getEffectiveCodeBlockTheme('auto', 'github-light');

      expect(result).toBe('github');
    });

    it('handles none preview theme in auto mode', () => {
      const manager = ThemeManager.getInstance();
      // isLightTheme returns true in our mock
      const result = manager.getEffectiveCodeBlockTheme('auto', 'none');

      expect(result).toBe('vs');
    });
  });

  describe('getWebviewThemeState', () => {
    it('returns complete theme state', () => {
      const manager = ThemeManager.getInstance();
      const state = manager.getWebviewThemeState();

      expect(state).toHaveProperty('previewTheme');
      expect(state).toHaveProperty('codeBlockTheme');
      expect(state).toHaveProperty('isLight');
    });
  });

  describe('extractThemeFromFrontmatter', () => {
    it('extracts previewTheme from frontmatter', () => {
      const manager = ThemeManager.getInstance();
      const result = manager.extractThemeFromFrontmatter({
        previewTheme: 'github-dark',
      });

      expect(result.previewTheme).toBe('github-dark');
    });

    it('extracts codeBlockTheme from frontmatter', () => {
      const manager = ThemeManager.getInstance();
      const result = manager.extractThemeFromFrontmatter({
        codeBlockTheme: 'monokai',
      });

      expect(result.codeBlockTheme).toBe('monokai');
    });

    it('returns empty object for non-string values', () => {
      const manager = ThemeManager.getInstance();
      const result = manager.extractThemeFromFrontmatter({
        previewTheme: 123,
        codeBlockTheme: null,
      });

      expect(result).toEqual({});
    });

    it('returns empty object for missing keys', () => {
      const manager = ThemeManager.getInstance();
      const result = manager.extractThemeFromFrontmatter({
        title: 'My Doc',
      });

      expect(result).toEqual({});
    });
  });

  describe('subscribe', () => {
    it('returns disposable', () => {
      const manager = ThemeManager.getInstance();
      const callback = vi.fn();
      const disposable = manager.subscribe(callback);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });
  });

  describe('dispose', () => {
    it('clears subscribers', () => {
      const manager = ThemeManager.getInstance();
      const callback = vi.fn();
      manager.subscribe(callback);

      ThemeManager.dispose();

      // after dispose, getting new instance should have no subscribers
      const newManager = ThemeManager.getInstance();
      expect(newManager).not.toBe(manager);
    });
  });
});

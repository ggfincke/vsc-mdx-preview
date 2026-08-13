// tests/extension/themes/ThemeManager.test.ts
// verify atomic settings & frontmatter theme derivation

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  mockConfigManager,
  mockPreviewManager,
} from '../../helpers/mock-services';
import { SETTINGS } from '../../../packages/extension-host/src/shared/config';
import { ThemeManager } from '../../../packages/extension-host/src/features/themes/ThemeManager';

describe('ThemeManager', () => {
  let originalThemeListener: unknown;

  beforeEach(() => {
    ThemeManager.reset();
    originalThemeListener = (
      vscode.window as unknown as Record<string, unknown>
    ).onDidChangeActiveColorTheme;
    (
      vscode.window as unknown as Record<string, unknown>
    ).onDidChangeActiveColorTheme = vi.fn(() => ({ dispose: vi.fn() }));
    const settings: Record<string, unknown> = {
      [SETTINGS.PREVIEW_THEME]: 'github-light',
      [SETTINGS.CODE_BLOCK_THEME]: 'auto',
      [SETTINGS.MERMAID_THEME]: 'default',
      [SETTINGS.AUTO_THEME]: true,
      [SETTINGS.PLANTUML_SERVER]: 'https://plantuml.example',
      [SETTINGS.MERMAID_ICON_PACKS]: [],
    };
    mockConfigManager.get.mockImplementation((key: string) => settings[key]);
  });

  afterEach(() => {
    ThemeManager.reset();
    const windowRecord = vscode.window as unknown as Record<string, unknown>;
    if (originalThemeListener === undefined) {
      delete windowRecord.onDidChangeActiveColorTheme;
    } else {
      windowRecord.onDidChangeActiveColorTheme = originalThemeListener;
    }
  });

  it('derives effective preview & code themes from validated overrides', () => {
    const manager = ThemeManager.getInstance();
    const isLightTheme = vi.spyOn(manager, 'isLightTheme');
    const overrides = manager.extractThemeFromFrontmatter({
      previewTheme: 'one-dark',
      ignoredTheme: 'monokai',
    });

    isLightTheme.mockReturnValue(false);
    expect(manager.getWebviewThemeState(undefined, overrides)).toEqual(
      expect.objectContaining({
        previewTheme: 'one-dark',
        codeBlockTheme: 'one-dark',
        isLight: false,
      })
    );

    isLightTheme.mockReturnValue(true);
    expect(manager.getWebviewThemeState(undefined, overrides)).toEqual(
      expect.objectContaining({
        previewTheme: 'one-light',
        codeBlockTheme: 'one-light',
        isLight: true,
      })
    );
    expect(
      manager.getWebviewThemeState(undefined, {
        ...overrides,
        codeBlockTheme: 'monokai',
      })
    ).toEqual(expect.objectContaining({ codeBlockTheme: 'monokai' }));
    expect(
      manager.extractThemeFromFrontmatter({
        previewTheme: 'not-a-theme',
        codeBlockTheme: 42,
      })
    ).toEqual({});
  });

  it('publishes retained preview state for VS Code & config theme changes', () => {
    let onColorThemeChange: (() => void) | undefined;
    let onConfigThemeChange: (() => void) | undefined;
    const pushThemeState = vi.fn();
    (
      vscode.window as unknown as Record<string, unknown>
    ).onDidChangeActiveColorTheme = vi.fn((callback: () => void) => {
      onColorThemeChange = callback;
      return { dispose: vi.fn() };
    });
    mockConfigManager.onDidChangeKey.mockImplementation((_keys, callback) => {
      onConfigThemeChange = callback;
      return { dispose: vi.fn() };
    });
    mockPreviewManager.getCurrentPreview.mockReturnValue({
      active: true,
      pushThemeState,
    });

    const manager = ThemeManager.getInstance();
    vi.spyOn(manager, 'isLightTheme').mockReturnValue(true);
    onColorThemeChange?.();
    onConfigThemeChange?.();

    expect(pushThemeState).toHaveBeenCalledTimes(2);
  });
});

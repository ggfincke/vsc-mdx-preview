// packages/extension-host/src/features/themes/ThemeManager.ts
// * ThemeManager - manage MPE-style preview & code block themes

import * as vscode from 'vscode';
import { WithSubscribers } from '../../app/services/SingletonService';
import { getConfigManager, getPreviewManager } from '../../app/services';
import { LogTags, FRONTMATTER_OVERRIDE_MAP } from '@mdx-preview/contracts';
import { SETTINGS, THEME_KEYS } from '../../shared/config';
import type {
  PreviewTheme,
  CodeBlockTheme,
  MermaidTheme,
  ThemeConfiguration,
  WebviewThemeState,
} from './types';
import { getOppositeTheme, isLightPreviewTheme } from './types';

// code block theme lookup by preview theme for auto mode
const CODE_BLOCK_THEME_MAP: Record<string, CodeBlockTheme> = {
  'github-light': 'github',
  'github-dark': 'github-dark',
  'atom-dark': 'atom-dark',
  'atom-light': 'atom-light',
  'atom-material': 'atom-material',
  'one-dark': 'one-dark',
  'one-light': 'one-light',
  'solarized-dark': 'solarized-dark',
  'solarized-light': 'solarized-light',
  monokai: 'monokai',
  vue: 'vue',
};

export class ThemeManager extends WithSubscribers<
  ThemeManager,
  WebviewThemeState
> {
  protected static override instance: ThemeManager | undefined;
  protected readonly logTag = LogTags.THEME_MANAGER;

  protected constructor() {
    super();
    this.addDisposable(
      this.subscribe(() => {
        const preview = getPreviewManager().getCurrentPreview();
        if (preview?.active) {
          preview.pushThemeState();
        }
      })
    );

    // listen to VS Code theme changes
    this.addDisposable(
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.notifyThemeSubscribers();
      })
    );

    // listen to configuration changes via centralized dispatcher
    this.addDisposable(
      getConfigManager().onDidChangeKey([...THEME_KEYS], () => {
        this.notifyThemeSubscribers();
      })
    );
  }

  // get theme configuration from settings
  getThemeConfiguration(docUri?: vscode.Uri): ThemeConfiguration {
    const configManager = getConfigManager();
    return {
      previewTheme: configManager.get(
        SETTINGS.PREVIEW_THEME,
        docUri
      ) as PreviewTheme,
      codeBlockTheme: configManager.get(
        SETTINGS.CODE_BLOCK_THEME,
        docUri
      ) as CodeBlockTheme,
      mermaidTheme: configManager.get(
        SETTINGS.MERMAID_THEME,
        docUri
      ) as MermaidTheme,
      autoTheme: configManager.get(SETTINGS.AUTO_THEME, docUri),
      plantUmlServer: configManager.get(SETTINGS.PLANTUML_SERVER, docUri),
      mermaidIconPacks: configManager.get(SETTINGS.MERMAID_ICON_PACKS, docUri),
    };
  }

  // check if VS Code is currently using a light theme
  isLightTheme(): boolean {
    const kind = vscode.window.activeColorTheme.kind;
    return (
      kind === vscode.ColorThemeKind.Light ||
      kind === vscode.ColorThemeKind.HighContrastLight
    );
  }

  // get the effective preview theme considering auto-switching
  getEffectivePreviewTheme(config: ThemeConfiguration): PreviewTheme {
    if (!config.autoTheme) {
      return config.previewTheme;
    }

    const vsCodeIsLight = this.isLightTheme();
    const themeIsLight = isLightPreviewTheme(config.previewTheme);

    // if theme lightness matches VS Code, keep it
    if (vsCodeIsLight === themeIsLight) {
      return config.previewTheme;
    }

    // otherwise, try to get the opposite theme
    return getOppositeTheme(config.previewTheme, vsCodeIsLight);
  }

  // get the effective code block theme considering auto mode
  getEffectiveCodeBlockTheme(
    codeBlockTheme: CodeBlockTheme,
    previewTheme: PreviewTheme
  ): CodeBlockTheme {
    if (codeBlockTheme !== 'auto') {
      return codeBlockTheme;
    }

    if (previewTheme === 'none') {
      return this.isLightTheme() ? 'vs' : 'default';
    }

    // select code block theme based on preview theme in auto mode
    return (
      CODE_BLOCK_THEME_MAP[previewTheme] ||
      (isLightPreviewTheme(previewTheme) ? 'github' : 'github-dark')
    );
  }

  // get the complete webview theme state
  getWebviewThemeState(docUri?: vscode.Uri): WebviewThemeState {
    const config = this.getThemeConfiguration(docUri);
    const effectivePreviewTheme = this.getEffectivePreviewTheme(config);
    const effectiveCodeBlockTheme = this.getEffectiveCodeBlockTheme(
      config.codeBlockTheme,
      effectivePreviewTheme
    );

    return {
      previewTheme: effectivePreviewTheme,
      codeBlockTheme: effectiveCodeBlockTheme,
      mermaidTheme: config.mermaidTheme,
      isLight: this.isLightTheme(),
      plantUmlServer: config.plantUmlServer,
      // resolved (file contents read) by PreviewWebviewBridge before sending
      mermaidIconPacks: [],
    };
  }

  // extract theme configuration from frontmatter (uses canonical override metadata)
  extractThemeFromFrontmatter(
    frontmatter: Record<string, unknown>
  ): Partial<ThemeConfiguration> {
    const result: Partial<ThemeConfiguration> = {};

    for (const [key, descriptor] of FRONTMATTER_OVERRIDE_MAP) {
      const value = frontmatter[key];
      if (typeof value !== 'string') {
        continue;
      }

      // validate against known values if descriptor provides them
      if (descriptor.validValues && !descriptor.validValues.includes(value)) {
        continue;
      }

      (result as Record<string, string>)[key] = value;
    }

    return result;
  }

  // notify all subscribers of theme change
  private notifyThemeSubscribers(): void {
    this.notifySubscribers(this.getWebviewThemeState());
  }

  // update theme setting
  async setPreviewTheme(theme: PreviewTheme, global = true): Promise<void> {
    await getConfigManager().set(
      SETTINGS.PREVIEW_THEME,
      theme,
      global
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace
    );
  }

  // update code block theme setting
  async setCodeBlockTheme(theme: CodeBlockTheme, global = true): Promise<void> {
    await getConfigManager().set(
      SETTINGS.CODE_BLOCK_THEME,
      theme,
      global
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace
    );
  }
}

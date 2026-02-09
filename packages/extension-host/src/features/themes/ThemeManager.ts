// packages/extension/themes/ThemeManager.ts
// * ThemeManager - manage MPE-style preview & code block themes

import * as vscode from 'vscode';
import { WithSubscribers } from '../../app/services/SingletonService';
import { getConfigManager } from '../../app/services';
import { LogTags } from '@mdx-preview/shared';
import { THEME_KEYS } from '../../shared/config';
import type {
  PreviewTheme,
  CodeBlockTheme,
  MermaidTheme,
  ThemeConfiguration,
  WebviewThemeState,
} from './types';
import { getOppositeTheme, isLightPreviewTheme } from './types';

export class ThemeManager extends WithSubscribers<
  ThemeManager,
  WebviewThemeState
> {
  protected static override instance: ThemeManager | undefined;
  protected readonly logTag = LogTags.THEME_MANAGER;

  protected constructor() {
    super(LogTags.THEME_MANAGER);
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
        'preview.previewTheme',
        docUri
      ) as PreviewTheme,
      codeBlockTheme: configManager.get(
        'preview.codeBlockTheme',
        docUri
      ) as CodeBlockTheme,
      mermaidTheme: configManager.get(
        'preview.mermaidTheme',
        docUri
      ) as MermaidTheme,
      autoTheme: configManager.get('preview.autoTheme', docUri),
      plantUmlServer: configManager.get('diagrams.plantUmlServer', docUri),
    };
  }

  // check if VS Code is currently using a light theme
  isLightTheme(): boolean {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
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
    const themeMap: Record<string, CodeBlockTheme> = {
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

    return (
      themeMap[previewTheme] ||
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
    };
  }

  // extract theme configuration from frontmatter
  extractThemeFromFrontmatter(
    frontmatter: Record<string, unknown>
  ): Partial<ThemeConfiguration> {
    const result: Partial<ThemeConfiguration> = {};

    if (typeof frontmatter.previewTheme === 'string') {
      result.previewTheme = frontmatter.previewTheme as PreviewTheme;
    }

    if (typeof frontmatter.codeBlockTheme === 'string') {
      result.codeBlockTheme = frontmatter.codeBlockTheme as CodeBlockTheme;
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
      'preview.previewTheme',
      theme,
      global
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace
    );
  }

  // update code block theme setting
  async setCodeBlockTheme(theme: CodeBlockTheme, global = true): Promise<void> {
    await getConfigManager().set(
      'preview.codeBlockTheme',
      theme,
      global
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace
    );
  }
}

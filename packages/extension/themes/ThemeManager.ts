// packages/extension/themes/ThemeManager.ts
// * ThemeManager - singleton for managing MPE-style themes

import * as vscode from 'vscode';
import type {
  PreviewTheme,
  CodeBlockTheme,
  ThemeConfiguration,
  WebviewThemeState,
} from './types';
import { getOppositeTheme, isLightPreviewTheme } from './types';

export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private disposables: vscode.Disposable[] = [];
  private subscribers: Set<(state: WebviewThemeState) => void> = new Set();

  private constructor() {
    // listen for VS Code theme changes
    this.disposables.push(
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.notifySubscribers();
      })
    );

    // listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview.preview')) {
          this.notifySubscribers();
        }
      })
    );
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  static dispose(): void {
    if (ThemeManager.instance) {
      ThemeManager.instance.disposables.forEach((d) => d.dispose());
      ThemeManager.instance.subscribers.clear();
      ThemeManager.instance = null;
    }
  }

  // get theme configuration from settings
  getThemeConfiguration(docUri?: vscode.Uri): ThemeConfiguration {
    const config = vscode.workspace.getConfiguration('mdx-preview', docUri);

    return {
      previewTheme: config.get<PreviewTheme>('preview.previewTheme', 'none'),
      codeBlockTheme: config.get<CodeBlockTheme>('preview.codeBlockTheme', 'auto'),
      autoTheme: config.get<boolean>('preview.autoTheme', true),
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

    // auto mode: select code block theme based on preview theme
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

    return themeMap[previewTheme] || (isLightPreviewTheme(previewTheme) ? 'github' : 'github-dark');
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
      isLight: this.isLightTheme(),
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

  // subscribe to theme changes
  subscribe(callback: (state: WebviewThemeState) => void): vscode.Disposable {
    this.subscribers.add(callback);
    return new vscode.Disposable(() => {
      this.subscribers.delete(callback);
    });
  }

  // notify all subscribers of theme change
  private notifySubscribers(): void {
    const state = this.getWebviewThemeState();
    for (const callback of this.subscribers) {
      callback(state);
    }
  }

  // update theme setting
  async setPreviewTheme(theme: PreviewTheme, global = true): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdx-preview');
    await config.update(
      'preview.previewTheme',
      theme,
      global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace
    );
  }

  // update code block theme setting
  async setCodeBlockTheme(theme: CodeBlockTheme, global = true): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdx-preview');
    await config.update(
      'preview.codeBlockTheme',
      theme,
      global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace
    );
  }
}

// packages/webview-app/src/theme/loader.ts
// theme CSS loading & injection for preview & code blocks

import { previewThemes, codeBlockThemes } from './css';
import { StyleInjector, STYLE_IDS } from '../utils/StyleInjector';
import type { PreviewTheme, CodeBlockTheme } from './types';

// inject preview theme CSS into the document
export function injectPreviewTheme(theme: PreviewTheme): void {
  const css = previewThemes[theme];
  // always inject to create the style element & set data attribute
  // Only set CSS content if truthy (matches original behavior)
  StyleInjector.inject(STYLE_IDS.PREVIEW_THEME, css || '', {
    dataAttribute: { name: 'data-mpe-preview-theme', value: theme },
  });
}

// inject code block theme CSS into the document
// set Shiki CSS variables for syntax highlighting colors
export function injectCodeBlockTheme(
  theme: CodeBlockTheme,
  isLight: boolean
): void {
  // handle 'auto' theme by selecting appropriate light/dark variant
  const effectiveTheme = getEffectiveCodeBlockTheme(theme, isLight);

  // inject CSS variables for the code block theme
  const css = codeBlockThemes[effectiveTheme];
  StyleInjector.inject(STYLE_IDS.CODE_BLOCK_THEME, css || '', {
    dataAttribute: { name: 'data-mpe-code-block-theme', value: effectiveTheme },
  });
}

// get effective code block theme considering auto mode
function getEffectiveCodeBlockTheme(
  theme: CodeBlockTheme,
  isLight: boolean
): CodeBlockTheme {
  if (theme !== 'auto') {
    return theme;
  }

  // auto mode: select based on light/dark
  return isLight ? 'github' : 'github-dark';
}

// remove all injected theme styles
export function clearThemeStyles(): void {
  StyleInjector.remove(STYLE_IDS.PREVIEW_THEME);
  StyleInjector.remove(STYLE_IDS.CODE_BLOCK_THEME);
  StyleInjector.removeDataAttribute('data-mpe-preview-theme');
  StyleInjector.removeDataAttribute('data-mpe-code-block-theme');
}

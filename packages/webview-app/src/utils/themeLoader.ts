// packages/webview-app/src/utils/themeLoader.ts
// theme loader utility for dynamic CSS injection

import { previewThemes, codeBlockThemes } from '../themes';
import type { PreviewTheme, CodeBlockTheme } from '@mdx-preview/shared-types';
import { isLightPreviewTheme } from '@mdx-preview/shared-types';

const PREVIEW_THEME_STYLE_ID = 'mpe-preview-theme';
const CODE_BLOCK_THEME_STYLE_ID = 'mpe-code-block-theme';

// inject preview theme CSS into the document
export function injectPreviewTheme(theme: PreviewTheme): void {
  let styleEl = document.getElementById(
    PREVIEW_THEME_STYLE_ID
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = PREVIEW_THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const css = previewThemes[theme];
  if (css) {
    styleEl.textContent = css;
  }

  // set data attribute for theme detection
  document.documentElement.setAttribute('data-mpe-preview-theme', theme);
}

// inject code block theme CSS into the document
// sets Shiki CSS variables for syntax highlighting colors
export function injectCodeBlockTheme(
  theme: CodeBlockTheme,
  isLight: boolean
): void {
  let styleEl = document.getElementById(
    CODE_BLOCK_THEME_STYLE_ID
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CODE_BLOCK_THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  // handle 'auto' theme by selecting appropriate light/dark variant
  const effectiveTheme = getEffectiveCodeBlockTheme(theme, isLight);

  // inject CSS variables for the code block theme
  const css = codeBlockThemes[effectiveTheme];
  styleEl.textContent = css || '';

  // set data attribute for theme detection
  document.documentElement.setAttribute(
    'data-mpe-code-block-theme',
    effectiveTheme
  );
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
  const previewStyle = document.getElementById(PREVIEW_THEME_STYLE_ID);
  const codeBlockStyle = document.getElementById(CODE_BLOCK_THEME_STYLE_ID);

  if (previewStyle) {
    previewStyle.remove();
  }
  if (codeBlockStyle) {
    codeBlockStyle.remove();
  }

  document.documentElement.removeAttribute('data-mpe-preview-theme');
  document.documentElement.removeAttribute('data-mpe-code-block-theme');
}

// re-export for backward compatibility
export { isLightPreviewTheme };

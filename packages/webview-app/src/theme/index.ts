// packages/webview-app/src/theme/index.ts
// barrel exports for theme module (context, hooks, utilities)
// NOTE: For raw CSS theme data, see themes/ (sibling directory)

// context & hooks
export { ThemeProvider, useTheme } from './context';

// theme types & constants (from shared package)
export type {
  PreviewTheme,
  CodeBlockTheme,
  WebviewThemeState,
} from '@mdx-preview/shared';
export {
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
} from '@mdx-preview/shared';

// VS Code theme detection
export type { VSCodeTheme } from './detection';
export {
  getCurrentVSCodeTheme,
  onVSCodeThemeChange,
  isVSCodeDark,
} from './detection';

// theme CSS loading
export {
  injectPreviewTheme,
  injectCodeBlockTheme,
  clearThemeStyles,
} from './loader';

// theme CSS content
export { previewThemes, codeBlockThemes } from './css';

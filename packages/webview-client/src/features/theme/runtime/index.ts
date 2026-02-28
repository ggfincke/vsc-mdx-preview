// packages/webview-client/src/features/theme/runtime/index.ts
// barrel exports for theme module (context, hooks, utilities)
// NOTE: for raw CSS theme data, see themes/ (sibling directory)

// context & hooks
export { ThemeProvider, useTheme } from './context';

// theme types & constants (from shared package)
export type {
  CodeBlockTheme,
  PreviewTheme,
  WebviewThemeState,
} from '@mdx-preview/contracts';
export {
  CODE_BLOCK_THEMES,
  PREVIEW_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
  isLightPreviewTheme,
} from '@mdx-preview/contracts';

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

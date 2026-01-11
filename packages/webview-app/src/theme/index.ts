// packages/webview-app/src/theme/index.ts
// barrel exports for theme module

// context and hooks
export { ThemeProvider, useTheme } from './context';

// theme types and constants
export type { PreviewTheme, CodeBlockTheme, WebviewThemeState } from './types';
export {
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
} from './types';

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

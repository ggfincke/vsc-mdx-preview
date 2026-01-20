// packages/webview-app/src/context/ThemeContext.tsx
// backward compatibility re-exports from theme module

// re-export everything from the new theme module
export { ThemeProvider, useTheme } from '../theme/context';

// re-export types w/ backward-compatible names
export type { VSCodeTheme as Theme } from '../theme/detection';
export type {
  PreviewTheme,
  CodeBlockTheme,
  WebviewThemeState,
} from '@mdx-preview/shared';

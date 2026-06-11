// packages/webview-client/src/features/theme/runtime/index.ts
// barrel exports for theme module (context, hooks, types)
// NOTE: for raw CSS theme data, see themes/ (sibling directory)

// context & hooks
export { ThemeProvider, useTheme } from './context';

// theme types (from shared package)
export type {
  CodeBlockTheme,
  PreviewTheme,
  WebviewThemeState,
} from '@mdx-preview/contracts';

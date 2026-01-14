// packages/webview-app/src/context/index.ts
// barrel export for React context providers

export {
  ThemeProvider,
  useTheme,
  type PreviewTheme,
  type CodeBlockTheme,
  type WebviewThemeState,
} from '../theme';
export type { VSCodeTheme as Theme } from '../theme/detection';

export { LightboxProvider, useLightbox } from './LightboxContext';

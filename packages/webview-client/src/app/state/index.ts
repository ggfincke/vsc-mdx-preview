// packages/webview-client/src/app/state/index.ts
// barrel export for React context providers

export {
  ThemeProvider,
  useTheme,
  type PreviewTheme,
  type CodeBlockTheme,
  type WebviewThemeState,
} from '../../features/theme/runtime';
export type { VSCodeTheme as Theme } from '../../features/theme/runtime/detection';

export { LightboxProvider, useLightbox } from './LightboxContext';

// phase J: granular state contexts for reduced re-renders
export { TrustProvider, useTrust } from './TrustContext';
export { PreviewProvider, usePreview } from './PreviewContext';
export { LoadingProvider, useLoading } from './LoadingContext';
export { NextraProvider, useNextra } from './NextraContext';
export { FrontmatterProvider, useFrontmatter } from './FrontmatterContext';
export { TocProvider, useToc, type TocHeading } from './TocContext';
export { WebviewStateProvider } from '../providers/WebviewStateProvider';

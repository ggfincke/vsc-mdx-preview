// packages/shared/themes/index.ts
// barrel export for shared theme types & data

export type {
  PreviewTheme,
  MermaidTheme,
  CodeBlockTheme,
  WebviewThemeState,
} from './types';

export {
  MERMAID_THEMES,
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
} from './data';

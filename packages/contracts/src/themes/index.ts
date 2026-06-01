// packages/contracts/src/themes/index.ts
// barrel export for theme types & data

export type {
  PreviewTheme,
  MermaidTheme,
  CodeBlockTheme,
  WebviewThemeState,
  MermaidIconPackSetting,
  ResolvedMermaidIconPack,
} from './types';

export {
  MERMAID_THEMES,
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
} from './data';

// packages/extension-host/src/features/themes/types.ts
// MPE-style theme type definitions

// re-export shared types & utilities from @mdx-preview/contracts
export type {
  CodeBlockTheme,
  MermaidTheme,
  PreviewTheme,
  WebviewThemeState,
} from '@mdx-preview/contracts';

export {
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  PREVIEW_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
  isLightPreviewTheme,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
} from '@mdx-preview/contracts';

import type {
  CodeBlockTheme,
  MermaidIconPackSetting,
  MermaidTheme,
  PreviewTheme,
} from '@mdx-preview/contracts';

// theme configuration (extension-only)
export interface ThemeConfiguration {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  mermaidTheme: MermaidTheme;
  autoTheme: boolean;
  plantUmlServer: string;
  mermaidIconPacks: MermaidIconPackSetting[];
}

export type ThemeOverrides = Partial<
  Pick<ThemeConfiguration, 'previewTheme' | 'codeBlockTheme'>
>;

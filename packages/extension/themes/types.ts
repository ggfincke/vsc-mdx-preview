// packages/extension/themes/types.ts
// theme type definitions for MPE-style theming

// re-export shared types & utilities from @mdx-preview/shared
export type {
  PreviewTheme,
  CodeBlockTheme,
  MermaidTheme,
  WebviewThemeState,
} from '@mdx-preview/shared';

export {
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
} from '@mdx-preview/shared';

import type {
  PreviewTheme,
  CodeBlockTheme,
  MermaidTheme,
} from '@mdx-preview/shared';

// theme configuration (extension-only)
export interface ThemeConfiguration {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  mermaidTheme: MermaidTheme;
  autoTheme: boolean;
}

// theme display names for UI (extension-only, for settings UI)
export const PREVIEW_THEME_LABELS: Record<PreviewTheme, string> = {
  'github-light': 'GitHub Light',
  'github-dark': 'GitHub Dark',
  'atom-dark': 'Atom Dark',
  'atom-light': 'Atom Light',
  'atom-material': 'Atom Material',
  'one-dark': 'One Dark',
  'one-light': 'One Light',
  'solarized-dark': 'Solarized Dark',
  'solarized-light': 'Solarized Light',
  gothic: 'Gothic',
  medium: 'Medium',
  monokai: 'Monokai',
  newsprint: 'Newsprint',
  night: 'Night',
  none: 'None',
  vue: 'Vue',
};

export const CODE_BLOCK_THEME_LABELS: Record<CodeBlockTheme, string> = {
  auto: 'Auto (match preview theme)',
  default: 'Default',
  'atom-dark': 'Atom Dark',
  'atom-light': 'Atom Light',
  'atom-material': 'Atom Material',
  coy: 'Coy',
  darcula: 'Darcula',
  dark: 'Dark',
  funky: 'Funky',
  github: 'GitHub',
  'github-dark': 'GitHub Dark',
  hopscotch: 'Hopscotch',
  monokai: 'Monokai',
  okaidia: 'Okaidia',
  'one-dark': 'One Dark',
  'one-light': 'One Light',
  'pen-paper-coffee': 'Pen Paper Coffee',
  pojoaque: 'Pojoaque',
  'solarized-dark': 'Solarized Dark',
  'solarized-light': 'Solarized Light',
  twilight: 'Twilight',
  vs: 'VS',
  vue: 'Vue',
  xonokai: 'Xonokai',
};

export const MERMAID_THEME_LABELS: Record<MermaidTheme, string> = {
  default: 'Default (Light)',
  dark: 'Dark',
  forest: 'Forest',
  neutral: 'Neutral',
  base: 'Base (Minimal)',
  null: 'None (Raw)',
};

// Note: MERMAID_THEMES is now re-exported from @mdx-preview/shared (canonical source)

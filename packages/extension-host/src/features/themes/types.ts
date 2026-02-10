// packages/extension/themes/types.ts
// MPE-style theme type definitions

// re-export shared types & utilities from @mdx-preview/shared
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
} from '@mdx-preview/contracts';

import type {
  CodeBlockTheme,
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
}

// theme display names (extension-only, used in settings UI)
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

// MERMAID_THEMES is re-exported from @mdx-preview/shared (canonical source)

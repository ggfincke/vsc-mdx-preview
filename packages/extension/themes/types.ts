// packages/extension/themes/types.ts
// theme type definitions for MPE-style theming

// re-export shared types & utilities from @mdx-preview/shared-types
export type {
  PreviewTheme,
  CodeBlockTheme,
  WebviewThemeState,
} from '@mdx-preview/shared-types';

export {
  isLightPreviewTheme,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  THEME_PAIRS,
  getOppositeTheme,
} from '@mdx-preview/shared-types';

import type { PreviewTheme, CodeBlockTheme } from '@mdx-preview/shared-types';

// theme configuration (extension-only)
export interface ThemeConfiguration {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
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

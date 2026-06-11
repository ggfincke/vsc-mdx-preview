// packages/contracts/src/themes/data.ts
// theme constants & utility functions

import type { PreviewTheme, CodeBlockTheme, MermaidTheme } from './types';

// canonical arrays live in types.ts; re-export for existing consumers
export { PREVIEW_THEMES, CODE_BLOCK_THEMES, MERMAID_THEMES } from './types';

// check if a preview theme is a light theme
export function isLightPreviewTheme(theme: PreviewTheme): boolean {
  return (
    theme.includes('light') ||
    ['medium', 'newsprint', 'gothic', 'none', 'vue'].includes(theme)
  );
}

// light/dark theme pairs for auto theme switching
export const THEME_PAIRS: Record<
  string,
  { light: PreviewTheme; dark: PreviewTheme }
> = {
  github: { light: 'github-light', dark: 'github-dark' },
  atom: { light: 'atom-light', dark: 'atom-dark' },
  one: { light: 'one-light', dark: 'one-dark' },
  solarized: { light: 'solarized-light', dark: 'solarized-dark' },
};

// find opposite theme for auto light/dark switching
export function getOppositeTheme(
  theme: PreviewTheme,
  targetIsLight: boolean
): PreviewTheme {
  for (const pair of Object.values(THEME_PAIRS)) {
    if (pair.light === theme && !targetIsLight) {
      return pair.dark;
    }
    if (pair.dark === theme && targetIsLight) {
      return pair.light;
    }
  }
  // return theme unchanged if no pair found
  return theme;
}

// theme display labels for settings UI & quick picks (canonical source)
// keys must match PREVIEW_THEMES array values
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

// keys must match CODE_BLOCK_THEMES array values
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

// keys must match MERMAID_THEMES array values
export const MERMAID_THEME_LABELS: Record<MermaidTheme, string> = {
  default: 'Default (Light)',
  dark: 'Dark',
  forest: 'Forest',
  neutral: 'Neutral',
  base: 'Base (Minimal)',
  null: 'None (Raw)',
};

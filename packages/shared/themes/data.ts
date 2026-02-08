// packages/shared/themes/data.ts
// theme constants & utility functions

import type { PreviewTheme, CodeBlockTheme, MermaidTheme } from './types';

// available mermaid themes array (canonical source)
export const MERMAID_THEMES: MermaidTheme[] = [
  'default',
  'dark',
  'forest',
  'neutral',
  'base',
  'null',
];

// check if a preview theme is a light theme
export function isLightPreviewTheme(theme: PreviewTheme): boolean {
  return (
    theme.includes('light') ||
    ['medium', 'newsprint', 'gothic', 'none', 'vue'].includes(theme)
  );
}

// available preview themes
export const PREVIEW_THEMES: PreviewTheme[] = [
  'github-light',
  'github-dark',
  'atom-dark',
  'atom-light',
  'atom-material',
  'one-dark',
  'one-light',
  'solarized-dark',
  'solarized-light',
  'gothic',
  'medium',
  'monokai',
  'newsprint',
  'night',
  'none',
  'vue',
];

// available code block themes
export const CODE_BLOCK_THEMES: CodeBlockTheme[] = [
  'auto',
  'default',
  'atom-dark',
  'atom-light',
  'atom-material',
  'coy',
  'darcula',
  'dark',
  'funky',
  'github',
  'github-dark',
  'hopscotch',
  'monokai',
  'okaidia',
  'one-dark',
  'one-light',
  'pen-paper-coffee',
  'pojoaque',
  'solarized-dark',
  'solarized-light',
  'twilight',
  'vs',
  'vue',
  'xonokai',
];

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

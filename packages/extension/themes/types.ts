// packages/extension/themes/types.ts
// theme type definitions for MPE-style theming

// available preview themes (markdown content styling)
export type PreviewTheme =
  | 'github-light'
  | 'github-dark'
  | 'atom-dark'
  | 'atom-light'
  | 'atom-material'
  | 'one-dark'
  | 'one-light'
  | 'solarized-dark'
  | 'solarized-light'
  | 'gothic'
  | 'medium'
  | 'monokai'
  | 'newsprint'
  | 'night'
  | 'none'
  | 'vue';

// available code block themes (syntax highlighting)
export type CodeBlockTheme =
  | 'auto'
  | 'default'
  | 'atom-dark'
  | 'atom-light'
  | 'atom-material'
  | 'coy'
  | 'darcula'
  | 'dark'
  | 'funky'
  | 'github'
  | 'github-dark'
  | 'hopscotch'
  | 'monokai'
  | 'okaidia'
  | 'one-dark'
  | 'one-light'
  | 'pen-paper-coffee'
  | 'pojoaque'
  | 'solarized-dark'
  | 'solarized-light'
  | 'twilight'
  | 'vs'
  | 'vue'
  | 'xonokai';

// theme configuration
export interface ThemeConfiguration {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  autoTheme: boolean;
}

// theme state sent to webview
export interface WebviewThemeState {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  isLight: boolean;
}

// list of all preview themes
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

// list of all code block themes
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

// theme display names for UI
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

// light/dark theme pairs for auto-switching
export const THEME_PAIRS: Record<string, { light: PreviewTheme; dark: PreviewTheme }> = {
  github: { light: 'github-light', dark: 'github-dark' },
  atom: { light: 'atom-light', dark: 'atom-dark' },
  one: { light: 'one-light', dark: 'one-dark' },
  solarized: { light: 'solarized-light', dark: 'solarized-dark' },
};

// get the opposite theme for auto light/dark switching
export function getOppositeTheme(theme: PreviewTheme, targetIsLight: boolean): PreviewTheme {
  for (const pair of Object.values(THEME_PAIRS)) {
    if (pair.light === theme && !targetIsLight) return pair.dark;
    if (pair.dark === theme && targetIsLight) return pair.light;
  }
  // no pair found, return as-is
  return theme;
}

// check if a theme is a light theme
export function isLightPreviewTheme(theme: PreviewTheme): boolean {
  return theme.includes('light') || ['medium', 'newsprint', 'gothic', 'none'].includes(theme);
}

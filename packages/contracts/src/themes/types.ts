// packages/contracts/src/themes/types.ts
// shared theme type definitions for extension & webview packages

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

// available mermaid diagram themes
export type MermaidTheme =
  | 'default'
  | 'dark'
  | 'forest'
  | 'neutral'
  | 'base'
  | 'null';

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

// mermaid icon pack as configured in settings
// source is a workspace-relative or absolute path to an Iconify JSON file
export interface MermaidIconPackSetting {
  name: string;
  source: string;
}

// mermaid icon pack after the host has read & parsed its JSON
// ready to send to the webview for registerIconPacks
export interface ResolvedMermaidIconPack {
  name: string;
  icons: unknown;
}

// theme state sent from extension to webview
export interface WebviewThemeState {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  mermaidTheme: MermaidTheme;
  isLight: boolean;
  plantUmlServer: string;
  mermaidIconPacks: ResolvedMermaidIconPack[];
}

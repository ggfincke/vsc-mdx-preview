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

// a single Iconify icon: an SVG body fragment + optional geometry/transform
export interface IconifyIcon {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  rotate?: number;
  hFlip?: boolean;
  vFlip?: boolean;
}

// minimal Iconify pack shape; validated & narrowed host-side before crossing
// the RPC boundary to the webview (see IconPackResolver.validateIconifyPack)
export interface IconifyIconPack {
  prefix?: string;
  width?: number;
  height?: number;
  icons: Record<string, IconifyIcon>;
}

// mermaid icon pack after the host has read, parsed & validated its JSON
// ready to send to the webview for registerIconPacks
export interface ResolvedMermaidIconPack {
  name: string;
  icons: IconifyIconPack;
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

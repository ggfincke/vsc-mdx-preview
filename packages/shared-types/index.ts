// packages/shared-types/index.ts
// shared type definitions for extension & webview packages

// result of fetching a module via RPC
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

// trust state synchronized between extension & webview
export interface TrustState {
  workspaceTrusted: boolean;
  scriptsEnabled: boolean;
  canExecute: boolean;
  reason?: string;
}

// preview error state
export interface PreviewError {
  message: string;
  stack?: string;
  code?: string;
}

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

// theme state sent from extension to webview
export interface WebviewThemeState {
  previewTheme: PreviewTheme;
  codeBlockTheme: CodeBlockTheme;
  isLight: boolean;
}

// check if a preview theme is a light theme
export function isLightPreviewTheme(theme: PreviewTheme): boolean {
  return (
    theme.includes('light') ||
    ['medium', 'newsprint', 'gothic', 'none', 'vue'].includes(theme)
  );
}

// RPC: methods extension exposes to webview (callable by webview)
export interface ExtensionRPC {
  handshake(): void;
  reportPerformance(evaluationDuration: number): void;
  fetch(
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined>;
  openSettings(settingId?: string): void;
  manageTrust(): void;
  openExternal(url: string): void;
  openDocument(
    relativePath: string,
    line?: number,
    column?: number
  ): Promise<void>;
}

// RPC: methods webview exposes to extension (callable by extension)
export interface WebviewRPC {
  setTrustState(state: TrustState): void;
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void;
  updatePreviewSafe(html: string): void;
  showPreviewError(error: PreviewError): void;
  invalidate(fsPath: string): Promise<void>;
  setStale(isStale: boolean): void;
  setCustomCss(css: string): void;
  setTheme(state: WebviewThemeState): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
}

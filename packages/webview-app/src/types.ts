// packages/webview-app/src/types.ts
// shared types for MDX Preview webview

// trust state synchronized from extension
export interface TrustState {
  workspaceTrusted: boolean;
  scriptsEnabled: boolean;
  canExecute: boolean;
  // reason why Trusted Mode is not available (if canExecute is false)
  reason?: string;
}

// frontmatter data parsed from YAML header
export interface Frontmatter {
  title?: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

// result from fetching module via RPC
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

// methods extension exposes to webview
export interface ExtensionHandleMethods {
  handshake(): void;
  reportPerformance(evaluationDuration: number): void;
  fetch(
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined>;
  openSettings(settingId?: string): void;
  manageTrust(): void;
  // link handling
  openExternal(url: string): void;
  openDocument(relativePath: string): Promise<void>;
  // scroll sync - webview reports visible line to extension
  revealLine(line: number): void;
}

// methods webview exposes to extension
export interface WebviewHandleMethods {
  setTrustState(state: TrustState): void;
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void;
  updatePreviewSafe(html: string): void;
  showPreviewError(error: { message: string; stack?: string }): void;
  invalidate(fsPath: string): Promise<void>;
  // stale indicator support
  setStale(isStale: boolean): void;
  // custom CSS hot-reload
  setCustomCss(css: string): void;
  // scroll sync - extension tells webview to scroll to line
  scrollToLine(line: number): void;
  setScrollSyncConfig(config: ScrollSyncConfig): void;
}

// preview content for Trusted Mode
export interface TrustedPreviewContent {
  mode: 'trusted';
  code: string;
  entryFilePath: string;
  dependencies: string[];
  frontmatter?: Frontmatter;
}

// preview content for Safe Mode
export interface SafePreviewContent {
  mode: 'safe';
  html: string;
  frontmatter?: Frontmatter;
}

// union type for preview content
export type PreviewContent = TrustedPreviewContent | SafePreviewContent;

// preview error state
export interface PreviewError {
  message: string;
  stack?: string;
}

// scroll sync configuration
export interface ScrollSyncConfig {
  enabled: boolean;
  behavior: 'instant' | 'smooth';
}

// complete preview state managed by App component
export interface PreviewState {
  trustState: TrustState;
  content: PreviewContent | null;
  error: PreviewError | null;
  isLoading: boolean;
}

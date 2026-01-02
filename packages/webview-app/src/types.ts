/**
 * Shared types for MDX Preview webview.
 */

/**
 * Trust state synchronized from the extension.
 */
export interface TrustState {
  workspaceTrusted: boolean;
  scriptsEnabled: boolean;
  canExecute: boolean;
  /** Reason why Trusted Mode is not available (if canExecute is false) */
  reason?: string;
}

/**
 * Result from fetching a module via RPC.
 */
export interface FetchResult {
  fsPath: string;
  code: string;
  dependencies: string[];
  css?: string;
}

/**
 * Methods the extension exposes to the webview.
 */
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
}

/**
 * Methods the webview exposes to the extension.
 */
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
}

/**
 * Preview content for Trusted Mode.
 */
export interface TrustedPreviewContent {
  mode: 'trusted';
  code: string;
  entryFilePath: string;
  dependencies: string[];
}

/**
 * Preview content for Safe Mode.
 */
export interface SafePreviewContent {
  mode: 'safe';
  html: string;
}

/**
 * Union type for preview content.
 */
export type PreviewContent = TrustedPreviewContent | SafePreviewContent;

/**
 * Preview error state.
 */
export interface PreviewError {
  message: string;
  stack?: string;
}

/**
 * Complete preview state managed by the App component.
 */
export interface PreviewState {
  trustState: TrustState;
  content: PreviewContent | null;
  error: PreviewError | null;
  isLoading: boolean;
}

// packages/contracts/src/rpc/types.ts
// shared RPC interface contracts between extension & webview

import type { Framework } from '../frameworks';
import type {
  FetchResult,
  TrustState,
  PreviewError,
  NextraPageMeta,
} from '../preview';
import type { PreviewRuntimeConfig } from '../config';
import type { WebviewThemeState } from '../themes';

export type PreviewSourceLineReportResult = 'accepted' | 'ignored' | 'retry';

// extension-exposed RPC methods
export interface ExtensionRPC {
  handshake(handshakeId: number): void;
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
  openPreview(relativePath: string): Promise<void>;
  openSourceLine(line: number): Promise<void>;
  reportPreviewSourceLine(line: number): Promise<PreviewSourceLineReportResult>;
  renderPlantUml(code: string): Promise<string | undefined>;
}

// webview-exposed RPC methods
export interface WebviewRPC {
  setTrustState(state: TrustState): void;
  setFramework(framework: Framework): void;
  // used components
  setUsedComponents(components: string[]): void;
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void;
  updatePreviewSafe(html: string): void;
  showPreviewError(error: PreviewError): void;
  invalidate(fsPath: string): Promise<void>;
  // clear caches
  clearAllCaches(): Promise<void>;
  setStale(isStale: boolean): void;
  setCustomCss(css: string): void;
  setTailwindCss(css: string): void;
  setTailwindBrowserCss(css: string): void;
  setTheme(state: WebviewThemeState): void;
  setNextraMeta(meta: NextraPageMeta | null): void;
  setRuntimeConfig(config: PreviewRuntimeConfig): void;
  scrollToLine(line: number): void;
  adjustZoom(delta: number): void;
  resetZoom(): void;
  getExportableHtml(): Promise<string>;
}

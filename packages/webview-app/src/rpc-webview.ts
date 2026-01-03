// packages/webview-app/src/rpc-webview.ts
// * RPC webview side - bidirectional communication between webview & extension via Comlink (React state architecture)

import * as comlink from 'comlink';
import type { Endpoint } from 'comlink';
import { debug } from './utils/debug';
import type {
  ExtensionHandleMethods,
  FetchResult,
  TrustState,
  PreviewError,
  ScrollSyncConfig,
} from './types';

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

// Comlink endpoint adapter for VS Code webview messaging
class WebviewProxy implements Endpoint {
  postMessage(message: unknown): void {
    debug('[RPC-WEBVIEW] postMessage to extension');
    vscodeApi.postMessage(message);
  }

  addEventListener = self.addEventListener.bind(self);
  removeEventListener = self.removeEventListener.bind(self);
}

// typed extension handle (methods available to call on extension)
export interface ExtensionHandle extends ExtensionHandleMethods {
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
  openDocument(relativePath: string): Promise<void>;
  revealLine(line: number): void;
}

let extensionHandle: ExtensionHandle;
let webviewEndpoint: WebviewProxy;

// handlers that update React state (registered by App component on mount)
interface WebviewStateHandlers {
  setTrustState: (state: TrustState) => void;
  setSafeContent: (html: string) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: string[]
  ) => void;
  setError: (error: PreviewError) => void;
  setStale: (isStale: boolean) => void;
  // Phase 2.2: Scroll sync
  scrollToLine?: (line: number) => void;
  setScrollSyncConfig?: (config: ScrollSyncConfig) => void;
}

let stateHandlers: WebviewStateHandlers | null = null;
type PendingMessage =
  | { type: 'trust'; payload: TrustState }
  | { type: 'safe'; payload: string }
  | {
      type: 'trusted';
      payload: {
        code: string;
        entryFilePath: string;
        dependencies: string[];
      };
    }
  | { type: 'error'; payload: PreviewError }
  | { type: 'stale'; payload: boolean };

const pendingMessages: PendingMessage[] = [];

function enqueueMessage(message: PendingMessage): void {
  debug(`[RPC-WEBVIEW] Enqueueing message: ${message.type}`);
  pendingMessages.push(message);
}

function flushPendingMessages(): void {
  debug(
    `[RPC-WEBVIEW] flushPendingMessages: ${pendingMessages.length} pending`
  );
  if (!stateHandlers || pendingMessages.length === 0) {
    return;
  }

  const messages = pendingMessages.splice(0, pendingMessages.length);
  for (const message of messages) {
    debug(`[RPC-WEBVIEW] Flushing message: ${message.type}`);
    switch (message.type) {
      case 'trust':
        stateHandlers.setTrustState(message.payload);
        break;
      case 'safe':
        stateHandlers.setSafeContent(message.payload);
        break;
      case 'trusted':
        stateHandlers.setTrustedContent(
          message.payload.code,
          message.payload.entryFilePath,
          message.payload.dependencies
        );
        break;
      case 'error':
        stateHandlers.setError(message.payload);
        break;
      case 'stale':
        stateHandlers.setStale(message.payload);
        break;
    }
  }
}

// RPC handle exposed to extension (routes calls to React state handlers)
class RPCWebviewHandle {
  // set trust state
  setTrustState(state: TrustState): void {
    debug('[RPC-WEBVIEW] setTrustState called', state);
    if (stateHandlers) {
      stateHandlers.setTrustState(state);
      return;
    }
    enqueueMessage({ type: 'trust', payload: state });
  }

  // update preview in Trusted Mode
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void {
    debug(
      `[RPC-WEBVIEW] updatePreview called, code length: ${code.length}, path: ${entryFilePath}`
    );
    if (stateHandlers) {
      debug('[RPC-WEBVIEW] Calling setTrustedContent directly');
      stateHandlers.setTrustedContent(
        code,
        entryFilePath,
        entryFileDependencies
      );
      return;
    }
    debug('[RPC-WEBVIEW] No stateHandlers, enqueueing');
    enqueueMessage({
      type: 'trusted',
      payload: {
        code,
        entryFilePath,
        dependencies: entryFileDependencies,
      },
    });
  }

  // update preview in Safe Mode
  updatePreviewSafe(html: string): void {
    debug(
      `[RPC-WEBVIEW] updatePreviewSafe called, html length: ${html.length}`
    );
    if (stateHandlers) {
      debug('[RPC-WEBVIEW] Calling setSafeContent directly');
      stateHandlers.setSafeContent(html);
      return;
    }
    debug('[RPC-WEBVIEW] No stateHandlers, enqueueing');
    enqueueMessage({ type: 'safe', payload: html });
  }

  // show preview error
  showPreviewError(error: { message: string; stack?: string }): void {
    debug('[RPC-WEBVIEW] showPreviewError called', error);
    if (stateHandlers) {
      stateHandlers.setError(error);
      return;
    }
    enqueueMessage({ type: 'error', payload: error });
  }

  // invalidate cached module
  async invalidate(fsPath: string): Promise<void> {
    debug(`[RPC-WEBVIEW] invalidate called: ${fsPath}`);
    // Import dynamically to avoid circular dependency
    const { invalidateModule } = await import('./module-loader');
    invalidateModule(fsPath);
  }

  // set stale indicator state
  setStale(isStale: boolean): void {
    debug(`[RPC-WEBVIEW] setStale called: ${isStale}`);
    if (stateHandlers) {
      stateHandlers.setStale(isStale);
      return;
    }
    enqueueMessage({ type: 'stale', payload: isStale });
  }

  // set custom CSS content (immediately updates style tag w/o preview refresh)
  setCustomCss(css: string): void {
    debug(`[RPC-WEBVIEW] setCustomCss called, length: ${css.length}`);

    // find or create custom CSS style element
    const STYLE_ID = 'mdx-preview-custom-css';
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = css;
  }

  // scroll to specific line (1-based from unified/remark)
  scrollToLine(line: number): void {
    debug(`[RPC-WEBVIEW] scrollToLine called: ${line}`);
    if (stateHandlers?.scrollToLine) {
      debug(`[RPC-WEBVIEW] scrollToLine: handler exists, calling`);
      stateHandlers.scrollToLine(line);
    } else {
      debug(`[RPC-WEBVIEW] scrollToLine: NO handler registered!`);
    }
  }

  // set scroll sync configuration
  setScrollSyncConfig(config: ScrollSyncConfig): void {
    debug(`[RPC-WEBVIEW] setScrollSyncConfig called`, config);
    if (stateHandlers?.setScrollSyncConfig) {
      stateHandlers.setScrollSyncConfig(config);
    }
  }
}

// initialize RPC on webview side (sets up bidirectional communication w/ extension)
export function initRPCWebviewSide(): void {
  debug('[RPC-WEBVIEW] initRPCWebviewSide called');
  webviewEndpoint = new WebviewProxy();

  // create proxy to call extension methods
  debug('[RPC-WEBVIEW] Wrapping extension handle');
  extensionHandle = comlink.wrap<ExtensionHandle>(webviewEndpoint);

  // expose webview methods for extension to call
  debug('[RPC-WEBVIEW] Creating RPCWebviewHandle');
  const webviewHandle = new RPCWebviewHandle();
  debug('[RPC-WEBVIEW] Exposing RPCWebviewHandle via comlink');
  comlink.expose(webviewHandle, webviewEndpoint);

  // notify extension that webview is ready
  debug('[RPC-WEBVIEW] Calling handshake()');
  extensionHandle.handshake();
  debug('[RPC-WEBVIEW] handshake() called');
}

// register React state handlers (called by App component on mount)
export function registerWebviewHandlers(handlers: WebviewStateHandlers): void {
  debug('[RPC-WEBVIEW] registerWebviewHandlers called');
  stateHandlers = handlers;
  flushPendingMessages();
  debug('[RPC-WEBVIEW] registerWebviewHandlers complete');
}

// get extension handle for calling extension methods
export { extensionHandle as ExtensionHandle };

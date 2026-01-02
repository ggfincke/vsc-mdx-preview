/**
 * RPC Webview Side
 *
 * Sets up bidirectional communication between webview and extension via Comlink.
 *
 * The new architecture uses React state for rendering. RPC handlers update
 * the App component's state rather than directly manipulating the DOM.
 */

import * as comlink from 'comlink';
import type { Endpoint } from 'comlink';
import type {
  ExtensionHandleMethods,
  FetchResult,
  TrustState,
  PreviewError,
} from './types';

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

/**
 * Comlink endpoint adapter for VS Code webview messaging.
 */
class WebviewProxy implements Endpoint {
  postMessage(message: unknown): void {
    console.log('[RPC-WEBVIEW] postMessage to extension');
    vscodeApi.postMessage(message);
  }

  addEventListener = self.addEventListener.bind(self);
  removeEventListener = self.removeEventListener.bind(self);
}

/**
 * Typed extension handle.
 * Methods available to call on the extension.
 */
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
}

let extensionHandle: ExtensionHandle;
let webviewEndpoint: WebviewProxy;

/**
 * Handlers that update React state.
 * Registered by the App component on mount.
 */
interface WebviewStateHandlers {
  setTrustState: (state: TrustState) => void;
  setSafeContent: (html: string) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: string[]
  ) => void;
  setError: (error: PreviewError) => void;
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
  | { type: 'error'; payload: PreviewError };

const pendingMessages: PendingMessage[] = [];

function enqueueMessage(message: PendingMessage): void {
  console.log(`[RPC-WEBVIEW] Enqueueing message: ${message.type}`);
  pendingMessages.push(message);
}

function flushPendingMessages(): void {
  console.log(
    `[RPC-WEBVIEW] flushPendingMessages: ${pendingMessages.length} pending`
  );
  if (!stateHandlers || pendingMessages.length === 0) {
    return;
  }

  const messages = pendingMessages.splice(0, pendingMessages.length);
  for (const message of messages) {
    console.log(`[RPC-WEBVIEW] Flushing message: ${message.type}`);
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
    }
  }
}

/**
 * RPC handle exposed to the extension.
 * Routes calls to React state handlers.
 */
class RPCWebviewHandle {
  /**
   * Set the trust state.
   */
  setTrustState(state: TrustState): void {
    console.log('[RPC-WEBVIEW] setTrustState called', state);
    if (stateHandlers) {
      stateHandlers.setTrustState(state);
      return;
    }
    enqueueMessage({ type: 'trust', payload: state });
  }

  /**
   * Update preview in Trusted Mode.
   */
  updatePreview(
    code: string,
    entryFilePath: string,
    entryFileDependencies: string[]
  ): void {
    console.log(
      `[RPC-WEBVIEW] updatePreview called, code length: ${code.length}, path: ${entryFilePath}`
    );
    if (stateHandlers) {
      console.log('[RPC-WEBVIEW] Calling setTrustedContent directly');
      stateHandlers.setTrustedContent(
        code,
        entryFilePath,
        entryFileDependencies
      );
      return;
    }
    console.log('[RPC-WEBVIEW] No stateHandlers, enqueueing');
    enqueueMessage({
      type: 'trusted',
      payload: {
        code,
        entryFilePath,
        dependencies: entryFileDependencies,
      },
    });
  }

  /**
   * Update preview in Safe Mode.
   */
  updatePreviewSafe(html: string): void {
    console.log(
      `[RPC-WEBVIEW] updatePreviewSafe called, html length: ${html.length}`
    );
    if (stateHandlers) {
      console.log('[RPC-WEBVIEW] Calling setSafeContent directly');
      stateHandlers.setSafeContent(html);
      return;
    }
    console.log('[RPC-WEBVIEW] No stateHandlers, enqueueing');
    enqueueMessage({ type: 'safe', payload: html });
  }

  /**
   * Show a preview error.
   */
  showPreviewError(error: { message: string; stack?: string }): void {
    console.log('[RPC-WEBVIEW] showPreviewError called', error);
    if (stateHandlers) {
      stateHandlers.setError(error);
      return;
    }
    enqueueMessage({ type: 'error', payload: error });
  }

  /**
   * Invalidate a cached module.
   */
  async invalidate(fsPath: string): Promise<void> {
    console.log(`[RPC-WEBVIEW] invalidate called: ${fsPath}`);
    // Import dynamically to avoid circular dependency
    const { invalidateModule } = await import('./module-loader');
    invalidateModule(fsPath);
  }
}

/**
 * Initialize RPC on the webview side.
 * Sets up bidirectional communication with the extension.
 */
export function initRPCWebviewSide(): void {
  console.log('[RPC-WEBVIEW] initRPCWebviewSide called');
  webviewEndpoint = new WebviewProxy();

  // Create proxy to call extension methods
  console.log('[RPC-WEBVIEW] Wrapping extension handle');
  extensionHandle = comlink.wrap<ExtensionHandle>(webviewEndpoint);

  // Expose webview methods for extension to call
  console.log('[RPC-WEBVIEW] Creating RPCWebviewHandle');
  const webviewHandle = new RPCWebviewHandle();
  console.log('[RPC-WEBVIEW] Exposing RPCWebviewHandle via comlink');
  comlink.expose(webviewHandle, webviewEndpoint);

  // Notify extension that webview is ready
  console.log('[RPC-WEBVIEW] Calling handshake()');
  extensionHandle.handshake();
  console.log('[RPC-WEBVIEW] handshake() called');
}

/**
 * Register React state handlers.
 * Called by the App component on mount.
 */
export function registerWebviewHandlers(handlers: WebviewStateHandlers): void {
  console.log('[RPC-WEBVIEW] registerWebviewHandlers called');
  stateHandlers = handlers;
  flushPendingMessages();
  console.log('[RPC-WEBVIEW] registerWebviewHandlers complete');
}

/**
 * Get the extension handle for calling extension methods.
 */
export { extensionHandle as ExtensionHandle };

// packages/webview-app/src/rpc-webview.ts
// * RPC webview side - bidirectional communication between webview & extension via Comlink (React state architecture)

import * as comlink from 'comlink';
import type { Endpoint } from 'comlink';
import { debug, debugError } from './utils/debug';
import type {
  ExtensionRPC,
  TrustState,
  PreviewError,
  WebviewThemeState,
} from '@mdx-preview/shared-types';

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
// type alias for shared ExtensionRPC (used by Comlink)
export type ExtensionHandle = ExtensionRPC;

let extensionHandle: ExtensionHandle;
let webviewEndpoint: WebviewProxy;

// handlers that update React state (registered by App component on mount)
interface WebviewStateHandlers {
  setTrustState: (state: TrustState) => void;
  setSafeContent: (html: string, frontmatter?: Record<string, unknown>) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: string[],
    frontmatter?: Record<string, unknown>
  ) => void;
  setError: (error: PreviewError) => void;
  setStale: (isStale: boolean) => void;
  // theme
  setTheme?: (state: WebviewThemeState) => void;
  // zoom
  zoomIn?: () => void;
  zoomOut?: () => void;
  resetZoom?: () => void;
}

let stateHandlers: WebviewStateHandlers | null = null;
type PendingMessage =
  | { type: 'trust'; payload: TrustState }
  | {
      type: 'safe';
      payload: { html: string; frontmatter?: Record<string, unknown> };
    }
  | {
      type: 'trusted';
      payload: {
        code: string;
        entryFilePath: string;
        dependencies: string[];
        frontmatter?: Record<string, unknown>;
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
        // pass frontmatter
        stateHandlers.setSafeContent(
          message.payload.html,
          message.payload.frontmatter
        );
        break;
      case 'trusted':
        // pass frontmatter
        stateHandlers.setTrustedContent(
          message.payload.code,
          message.payload.entryFilePath,
          message.payload.dependencies,
          message.payload.frontmatter
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
    entryFileDependencies: string[],
    frontmatter?: Record<string, unknown>
  ): void {
    debug(
      `[RPC-WEBVIEW] updatePreview called, code length: ${code.length}, path: ${entryFilePath}`
    );
    if (stateHandlers) {
      debug('[RPC-WEBVIEW] Calling setTrustedContent directly');
      stateHandlers.setTrustedContent(
        code,
        entryFilePath,
        entryFileDependencies,
        frontmatter
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
        frontmatter,
      },
    });
  }

  // update preview in Safe Mode
  updatePreviewSafe(html: string, frontmatter?: Record<string, unknown>): void {
    debug(
      `[RPC-WEBVIEW] updatePreviewSafe called, html length: ${html.length}`
    );
    if (stateHandlers) {
      debug('[RPC-WEBVIEW] Calling setSafeContent directly');
      stateHandlers.setSafeContent(html, frontmatter);
      return;
    }
    debug('[RPC-WEBVIEW] No stateHandlers, enqueueing');
    enqueueMessage({ type: 'safe', payload: { html, frontmatter } });
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

  // set preview theme (MPE-style themes)
  setTheme(state: WebviewThemeState): void {
    debug(`[RPC-WEBVIEW] setTheme called`, state);
    if (stateHandlers?.setTheme) {
      stateHandlers.setTheme(state);
    }
  }

  // zoom controls
  zoomIn(): void {
    debug('[RPC-WEBVIEW] zoomIn called');
    if (stateHandlers?.zoomIn) {
      stateHandlers.zoomIn();
    }
  }

  zoomOut(): void {
    debug('[RPC-WEBVIEW] zoomOut called');
    if (stateHandlers?.zoomOut) {
      stateHandlers.zoomOut();
    }
  }

  resetZoom(): void {
    debug('[RPC-WEBVIEW] resetZoom called');
    if (stateHandlers?.resetZoom) {
      stateHandlers.resetZoom();
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
  try {
    stateHandlers = handlers;
    flushPendingMessages();
    debug('[RPC-WEBVIEW] registerWebviewHandlers complete');
  } catch (e) {
    // ! registration failure is critical - retry after brief delay
    debugError('[RPC-WEBVIEW] Handler registration failed, retrying...', e);
    setTimeout(() => {
      try {
        stateHandlers = handlers;
        flushPendingMessages();
        debug('[RPC-WEBVIEW] registerWebviewHandlers retry successful');
      } catch (retryError) {
        debugError(
          '[RPC-WEBVIEW] Handler registration retry failed',
          retryError
        );
      }
    }, 100);
  }
}

// get extension handle for calling extension methods
export { extensionHandle as ExtensionHandle };

// packages/webview-app/src/rpc-webview.ts
// * RPC webview side - bidirectional communication btwn webview & extension via Comlink
//
// Message Queue Architecture
// ==========================
//
// The webview receives Comlink RPC messages immediately on load, but React
// may not have mounted yet. This creates a timing race:
//
// Timeline:
// 1. Webview HTML loads
// 2. initRPCWebviewSide() - Comlink endpoint ready
// 3. Extension sends initial messages (trust state, preview content)
// 4. React begins mounting (async)
// 5. App calls registerWebviewHandlers()
// 6. Pending messages flushed to React state
//
// The pendingMessages queue buffers messages between steps 3-5.
//
// Queued message types: trust, safe, trusted, error, stale
// Direct (not queued): theme, zoom, CSS, Tailwind (update DOM directly)

import * as comlink from 'comlink';
import type { Endpoint } from 'comlink';
import { debug, debugError } from './utils/debug';
import { StyleInjector, STYLE_IDS } from './utils/StyleInjector';
import {
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
} from './constants';
import type {
  ExtensionRPC,
  WebviewRPC,
  TrustState,
  PreviewError,
  WebviewThemeState,
  NextraPageMeta,
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
  setSafeContent: (html: string) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: string[]
  ) => void;
  setError: (error: PreviewError) => void;
  setStale: (isStale: boolean) => void;
  // theme
  setTheme?: (state: WebviewThemeState) => void;
  // Nextra page metadata
  setNextraMeta?: (meta: NextraPageMeta) => void;
  // zoom
  zoomIn?: () => void;
  zoomOut?: () => void;
  resetZoom?: () => void;
}

let stateHandlers: WebviewStateHandlers | null = null;
type PendingMessage =
  | { type: 'trust'; payload: TrustState }
  | { type: 'safe'; payload: { html: string } }
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

// Compile-time exhaustiveness check for message types
function assertNever(x: never): never {
  throw new Error(`Unexpected message type: ${JSON.stringify(x)}`);
}

// Use Map to coalesce by message type - last message of each type wins
// This prevents stale messages from replaying out of order when React mounts slowly
const pendingMessages = new Map<PendingMessage['type'], PendingMessage>();

function enqueueMessage(message: PendingMessage): void {
  const hadPrevious = pendingMessages.has(message.type);
  debug(
    `[RPC-WEBVIEW] Enqueueing message: ${message.type}${hadPrevious ? ' (replacing previous)' : ''}`
  );
  // Coalesce: newer message of same type replaces older
  pendingMessages.set(message.type, message);
}

function flushPendingMessages(): void {
  debug(`[RPC-WEBVIEW] flushPendingMessages: ${pendingMessages.size} pending`);
  if (!stateHandlers || pendingMessages.size === 0) {
    return;
  }

  // Process in a defined order for consistency:
  // 1. Trust state first (sets rendering mode)
  // 2. Content second (safe or trusted - only one will be present due to coalescing)
  // 3. Error/stale last (overlays)
  const processingOrder: PendingMessage['type'][] = [
    'trust',
    'safe',
    'trusted',
    'error',
    'stale',
  ];

  // Copy and clear atomically
  const messages = new Map(pendingMessages);
  pendingMessages.clear();

  for (const type of processingOrder) {
    const message = messages.get(type);
    if (!message) {
      continue;
    }

    debug(`[RPC-WEBVIEW] Flushing message: ${message.type}`);
    switch (message.type) {
      case 'trust':
        stateHandlers.setTrustState(message.payload);
        break;
      case 'safe':
        stateHandlers.setSafeContent(message.payload.html);
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
      default:
        assertNever(message);
    }
  }
}

// RPC handle exposed to extension (routes calls to React state handlers)
class RPCWebviewHandle implements WebviewRPC {
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
    enqueueMessage({ type: 'safe', payload: { html } });
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
    // ! import dynamically to avoid circular dependency w/ module-loader
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
    StyleInjector.inject(STYLE_IDS.CUSTOM_CSS, css);
  }

  // set Tailwind CSS content (keeps custom CSS last for overrides)
  setTailwindCss(css: string): void {
    debug(`[RPC-WEBVIEW] setTailwindCss called, length: ${css.length}`);
    StyleInjector.inject(STYLE_IDS.TAILWIND_CSS, css, {
      insertBefore: STYLE_IDS.CUSTOM_CSS,
    });
  }

  // set preview theme (MPE-style themes)
  setTheme(state: WebviewThemeState): void {
    debug(`[RPC-WEBVIEW] setTheme called`, state);
    if (stateHandlers?.setTheme) {
      stateHandlers.setTheme(state);
    }
  }

  // set Nextra page metadata (title, layout, etc.)
  setNextraMeta(meta: NextraPageMeta): void {
    debug(`[RPC-WEBVIEW] setNextraMeta called`, meta);
    if (stateHandlers?.setNextraMeta) {
      stateHandlers.setNextraMeta(meta);
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

    // Warn if many messages accumulated (potential timing issue)
    // Note: With coalescing, this is less likely but still possible with many message types
    if (pendingMessages.size > RPC_PENDING_MESSAGES_WARNING_THRESHOLD) {
      debugError(
        `[RPC-WEBVIEW] Warning: ${pendingMessages.size} pending messages accumulated`
      );
    }

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
    }, RPC_HANDLER_RETRY_DELAY_MS);
  }
}

// get extension handle for calling extension methods
export { extensionHandle as ExtensionHandle };

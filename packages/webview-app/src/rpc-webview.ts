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
import { createTaggedLogger } from './utils/debug';
import { StyleInjector, STYLE_IDS } from './utils/StyleInjector';
import {
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
} from './constants';
import type {
  ExtensionRPC,
  WebviewRPC,
  TrustState,
  PreviewError,
  Framework,
} from '@mdx-preview/shared';
import {
  createHandlerFactories,
  type WebviewStateHandlers,
  type PendingMessage,
  type QueuedMessageType,
} from './rpc/handler-factory';
import {
  SET_TRUST_STATE_CONFIG,
  UPDATE_PREVIEW_CONFIG,
  UPDATE_PREVIEW_SAFE_CONFIG,
  SHOW_PREVIEW_ERROR_CONFIG,
  SET_STALE_CONFIG,
  SET_THEME_CONFIG,
  SET_NEXTRA_META_CONFIG,
  ZOOM_IN_CONFIG,
  ZOOM_OUT_CONFIG,
  RESET_ZOOM_CONFIG,
} from './rpc/handler-configs';

// Create tagged logger for this module
const log = createTaggedLogger('RPC-WEBVIEW');

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

// Comlink endpoint adapter for VS Code webview messaging
class WebviewProxy implements Endpoint {
  postMessage(message: unknown): void {
    log.debug('postMessage to extension');
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

// Module-level state for handlers & pending messages
let stateHandlers: WebviewStateHandlers | null = null;

// K.1: Cache for ./module-system dynamic import
// Avoids repeated promise creation on each RPC call
// Uses error recovery pattern to reset cache on failure
let moduleSystemPromise: Promise<typeof import('./module-system')> | null = null;

function getModuleSystem(): Promise<typeof import('./module-system')> {
  if (!moduleSystemPromise) {
    moduleSystemPromise = import('./module-system').catch((err) => {
      // Reset cache on failure so subsequent calls can retry
      moduleSystemPromise = null;
      throw err;
    });
  }
  return moduleSystemPromise;
}

// Compile-time exhaustiveness check for message types
function assertNever(x: never): never {
  throw new Error(`Unexpected message type: ${JSON.stringify(x)}`);
}

// Use Map to coalesce by message type - last message of each type wins
// This prevents stale messages from replaying out of order when React mounts slowly
const pendingMessages = new Map<QueuedMessageType, PendingMessage>();

function enqueueMessage(message: PendingMessage): void {
  const hadPrevious = pendingMessages.has(message.type);
  log.debug(
    `Enqueueing message: ${message.type}${hadPrevious ? ' (replacing previous)' : ''}`
  );
  // Coalesce: newer message of same type replaces older
  pendingMessages.set(message.type, message);
}

function flushPendingMessages(): void {
  log.debug(`flushPendingMessages: ${pendingMessages.size} pending`);
  if (!stateHandlers || pendingMessages.size === 0) {
    return;
  }

  // Process in a defined order for consistency:
  // 1. Trust state first (sets rendering mode)
  // 2. Content second (safe or trusted - only one will be present due to coalescing)
  // 3. Error/stale last (overlays)
  const processingOrder: QueuedMessageType[] = [
    'trust',
    'safe',
    'trusted',
    'error',
    'stale',
  ];

  // Copy & clear atomically
  const messages = new Map(pendingMessages);
  pendingMessages.clear();

  for (const type of processingOrder) {
    const message = messages.get(type);
    if (!message) {
      continue;
    }

    log.debug(`Flushing message: ${message.type}`);
    switch (message.type) {
      case 'trust':
        stateHandlers.setTrustState(message.payload as TrustState);
        break;
      case 'safe':
        stateHandlers.setSafeContent(
          (message.payload as { html: string }).html
        );
        break;
      case 'trusted': {
        const payload = message.payload as {
          code: string;
          entryFilePath: string;
          dependencies: string[];
        };
        stateHandlers.setTrustedContent(
          payload.code,
          payload.entryFilePath,
          payload.dependencies
        );
        break;
      }
      case 'error':
        stateHandlers.setError(message.payload as PreviewError);
        break;
      case 'stale':
        stateHandlers.setStale(message.payload as boolean);
        break;
      default:
        assertNever(message);
    }
  }
}

// Create handler factories bound to module state
const { createQueuedHandler, createOptionalHandler } = createHandlerFactories(
  () => stateHandlers,
  enqueueMessage
);

// RPC handle exposed to extension (routes calls to React state handlers)
class RPCWebviewHandle implements WebviewRPC {
  // QUEUED handlers - buffer messages until React mounts
  setTrustState = createQueuedHandler(SET_TRUST_STATE_CONFIG, log);
  updatePreview = createQueuedHandler(UPDATE_PREVIEW_CONFIG, log);
  updatePreviewSafe = createQueuedHandler(UPDATE_PREVIEW_SAFE_CONFIG, log);
  showPreviewError = createQueuedHandler(SHOW_PREVIEW_ERROR_CONFIG, log);
  setStale = createQueuedHandler(SET_STALE_CONFIG, log);

  // OPTIONAL handlers - call if handler present, no queuing
  setTheme = createOptionalHandler(SET_THEME_CONFIG, log);
  setNextraMeta = createOptionalHandler(SET_NEXTRA_META_CONFIG, log);
  zoomIn = createOptionalHandler(ZOOM_IN_CONFIG, log);
  zoomOut = createOptionalHandler(ZOOM_OUT_CONFIG, log);
  resetZoom = createOptionalHandler(RESET_ZOOM_CONFIG, log);

  // DIRECT handlers - immediate DOM/style injection (kept manual for simplicity)
  setCustomCss(css: string): void {
    log.debug(`setCustomCss called, length: ${css.length}`);
    StyleInjector.inject(STYLE_IDS.CUSTOM_CSS, css);
  }

  setTailwindCss(css: string): void {
    log.debug(`setTailwindCss called, length: ${css.length}`);
    StyleInjector.inject(STYLE_IDS.TAILWIND_CSS, css, {
      insertBefore: STYLE_IDS.CUSTOM_CSS,
    });
  }

  // DIRECT handler - load framework-specific shims on demand
  setFramework(framework: Framework): void {
    log.debug(`setFramework called: ${framework}`);
    // K.1: use cached module import to avoid repeated promise creation
    void getModuleSystem().then(({ ensureFrameworkShimsLoaded }) => {
      ensureFrameworkShimsLoaded(framework);
    });
  }

  // DIRECT handler - load specific generic shims on demand (conditional preloading)
  setUsedComponents(components: string[]): void {
    log.debug(`setUsedComponents called: ${components.join(', ')}`);
    // K.1: use cached module import to avoid repeated promise creation
    void getModuleSystem().then(({ ensureGenericShimsLoaded }) => {
      ensureGenericShimsLoaded(components);
    });
  }

  // EXCEPTION handler - async w/ dynamic import (kept manual)
  async invalidate(fsPath: string): Promise<void> {
    log.debug(`invalidate called: ${fsPath}`);
    // K.1: use cached module import to avoid repeated promise creation
    const { invalidateModule } = await getModuleSystem();
    invalidateModule(fsPath);
  }
}

// initialize RPC on webview side (sets up bidirectional communication w/ extension)
export function initRPCWebviewSide(): void {
  log.debug('initRPCWebviewSide called');
  webviewEndpoint = new WebviewProxy();

  // create proxy to call extension methods
  log.debug('Wrapping extension handle');
  extensionHandle = comlink.wrap<ExtensionHandle>(webviewEndpoint);

  // expose webview methods for extension to call
  log.debug('Creating RPCWebviewHandle');
  const webviewHandle = new RPCWebviewHandle();
  log.debug('Exposing RPCWebviewHandle via comlink');
  comlink.expose(webviewHandle, webviewEndpoint);

  // notify extension that webview is ready
  log.debug('Calling handshake()');
  extensionHandle.handshake();
  log.debug('handshake() called');
}

// K.3: Prevent double-registration during retry
let registrationInProgress = false;

// K.3: Helper for exponential backoff retry
function attemptRegistration(handlers: WebviewStateHandlers, attempt: number): void {
  registrationInProgress = true;

  try {
    stateHandlers = handlers;

    // Warn if many messages accumulated (potential timing issue)
    // Note: w/ coalescing, this is less likely but still possible w/ many message types
    if (pendingMessages.size > RPC_PENDING_MESSAGES_WARNING_THRESHOLD) {
      log.error(
        `Warning: ${pendingMessages.size} pending messages accumulated`
      );
    }

    flushPendingMessages();
    registrationInProgress = false;
    log.debug('registerWebviewHandlers complete');
  } catch (e) {
    if (attempt < RPC_HANDLER_MAX_RETRIES) {
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms delays
      const delay = RPC_HANDLER_RETRY_DELAY_MS * Math.pow(2, attempt);
      log.debug(
        `Handler registration failed (attempt ${attempt + 1}), retrying in ${delay}ms...`
      );
      setTimeout(() => attemptRegistration(handlers, attempt + 1), delay);
    } else {
      registrationInProgress = false;
      log.error(
        `Handler registration failed after ${attempt + 1} attempts`,
        e
      );
    }
  }
}

// register React state handlers (called by App component on mount)
export function registerWebviewHandlers(handlers: WebviewStateHandlers): void {
  log.debug('registerWebviewHandlers called');

  // K.3: Prevent duplicate registration during retry
  if (registrationInProgress) {
    log.debug('Registration already in progress, ignoring duplicate call');
    return;
  }

  attemptRegistration(handlers, 0);
}

// get extension handle for calling extension methods
export { extensionHandle as ExtensionHandle };

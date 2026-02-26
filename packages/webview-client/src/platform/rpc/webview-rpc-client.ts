// packages/webview-app/src/rpc-webview.ts
// RPC webview side - bidirectional communication between webview & extension via Comlink
// message queue buffers messages until React mounts (queued: trust, safe, trusted, error, stale)
// direct handlers (theme, CSS, Tailwind) update DOM immediately w/o queueing

import * as comlink from 'comlink';
import type { Endpoint } from 'comlink';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { StyleInjector, STYLE_IDS } from '../../shared/utils/StyleInjector';
import {
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
} from '../../app/constants';
import {
  type ExtensionRPC,
  type Framework,
  type PreviewError,
  type TrustState,
  type WebviewRPC,
  LogTags,
} from '@mdx-preview/contracts';
import {
  createHandlerFactories,
  type WebviewStateHandlers,
  type PendingMessage,
  type QueuedMessageType,
  SET_TRUST_STATE_CONFIG,
  UPDATE_PREVIEW_CONFIG,
  UPDATE_PREVIEW_SAFE_CONFIG,
  SHOW_PREVIEW_ERROR_CONFIG,
  SET_STALE_CONFIG,
  SET_THEME_CONFIG,
  SET_NEXTRA_META_CONFIG,
  SET_FRONTMATTER_CONFIG,
  SET_SHOW_TOC_CONFIG,
} from './handler-factory';

// create tagged logger for this module
const log = createTaggedLogger(LogTags.RPC_WEBVIEW);

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

// comlink endpoint adapter for VS Code webview messaging
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

// module-level state for handlers & pending messages
let stateHandlers: WebviewStateHandlers | null = null;

// K.1: cache for ./module-system dynamic import (avoids repeated promise creation)
// use error recovery pattern to reset cache on failure
let moduleSystemPromise: Promise<
  typeof import('../../features/module-runtime')
> | null = null;

function getModuleSystem(): Promise<
  typeof import('../../features/module-runtime')
> {
  if (!moduleSystemPromise) {
    moduleSystemPromise = import('../../features/module-runtime').catch(
      (err) => {
        // reset cache on failure so subsequent calls can retry
        moduleSystemPromise = null;
        throw err;
      }
    );
  }
  return moduleSystemPromise;
}

// use Map to coalesce by message type - last message of each type wins
// this prevents stale messages from replaying out of order when React mounts slowly
const pendingMessages = new Map<QueuedMessageType, PendingMessage>();

// track current trust state for content validation
let currentTrustState: TrustState | null = null;

function enqueueMessage(message: PendingMessage): void {
  const hadPrevious = pendingMessages.has(message.type);
  log.debug(
    `Enqueueing message: ${message.type}${hadPrevious ? ' (replacing previous)' : ''}`
  );
  // coalesce: newer message of same type replaces older
  pendingMessages.set(message.type, message);
}

// validate content mode matches trust state (return true if content should be processed)
function validateContentMode(
  trustState: TrustState | null,
  contentMode: 'safe' | 'trusted'
): boolean {
  if (!trustState) {
    // no trust state yet - can't validate, allow content through
    return true;
  }

  if (contentMode === 'trusted' && !trustState.canExecute) {
    log.warn(
      'Discarding trusted content - trust state is not canExecute (scripts disabled or workspace untrusted)'
    );
    return false;
  }

  // safe content is always allowed (fallback mode)
  return true;
}

function flushPendingMessages(): void {
  log.debug(`flushPendingMessages: ${pendingMessages.size} pending`);
  if (!stateHandlers || pendingMessages.size === 0) {
    return;
  }

  // copy & clear atomically
  const messages = new Map(pendingMessages);
  pendingMessages.clear();

  // phase 1: process trust state first (sets rendering mode)
  const trustMessage = messages.get('trust');
  if (trustMessage) {
    log.debug('Flushing trust state first');
    currentTrustState = trustMessage.payload as TrustState;
    stateHandlers.setTrustState(currentTrustState);
  }

  // phase 2: process content w/ validation
  // only one of safe/trusted should be present, but handle both defensively
  const safeMsg = messages.get('safe');
  const trustedMsg = messages.get('trusted');

  if (safeMsg && trustedMsg) {
    // both present - use the one matching trust state, discard other
    log.warn('Both safe & trusted content queued - selecting based on trust');
    if (currentTrustState?.canExecute) {
      // prefer trusted in trusted mode
      if (validateContentMode(currentTrustState, 'trusted')) {
        const payload = trustedMsg.payload as {
          code: string;
          entryFilePath: string;
          dependencies: string[];
        };
        log.debug('Flushing trusted content (trusted mode active)');
        stateHandlers.setTrustedContent(
          payload.code,
          payload.entryFilePath,
          payload.dependencies
        );
      }
    } else {
      // use safe in safe mode
      log.debug('Flushing safe content (safe mode active)');
      stateHandlers.setSafeContent((safeMsg.payload as { html: string }).html);
    }
  } else if (trustedMsg) {
    if (validateContentMode(currentTrustState, 'trusted')) {
      const payload = trustedMsg.payload as {
        code: string;
        entryFilePath: string;
        dependencies: string[];
      };
      log.debug('Flushing trusted content');
      stateHandlers.setTrustedContent(
        payload.code,
        payload.entryFilePath,
        payload.dependencies
      );
    }
  } else if (safeMsg) {
    log.debug('Flushing safe content');
    stateHandlers.setSafeContent((safeMsg.payload as { html: string }).html);
  }

  // phase 3: process overlays (error, stale)
  const errorMsg = messages.get('error');
  if (errorMsg) {
    log.debug('Flushing error');
    stateHandlers.setError(errorMsg.payload as PreviewError);
  }

  const staleMsg = messages.get('stale');
  if (staleMsg) {
    log.debug('Flushing stale');
    stateHandlers.setStale(staleMsg.payload as boolean);
  }
}

// create handler factories bound to module state
const { createQueuedHandler, createOptionalHandler } = createHandlerFactories(
  () => stateHandlers,
  enqueueMessage
);

// RPC handle exposed to extension (route calls to React state handlers)
class RPCWebviewHandle implements WebviewRPC {
  // queued handlers - buffer messages until React mounts
  setTrustState = createQueuedHandler(SET_TRUST_STATE_CONFIG, log);
  updatePreview = createQueuedHandler(UPDATE_PREVIEW_CONFIG, log);
  updatePreviewSafe = createQueuedHandler(UPDATE_PREVIEW_SAFE_CONFIG, log);
  showPreviewError = createQueuedHandler(SHOW_PREVIEW_ERROR_CONFIG, log);
  setStale = createQueuedHandler(SET_STALE_CONFIG, log);

  // optional handlers - call if handler present, no queuing
  setTheme = createOptionalHandler(SET_THEME_CONFIG, log);
  setNextraMeta = createOptionalHandler(SET_NEXTRA_META_CONFIG, log);
  setFrontmatter = createOptionalHandler(SET_FRONTMATTER_CONFIG, log);
  setShowToc = createOptionalHandler(SET_SHOW_TOC_CONFIG, log);

  // direct handlers - immediate DOM/style injection (kept manual for simplicity)
  setCustomCss(css: string): void {
    log.debug(`setCustomCss called, length: ${css.length}`);
    StyleInjector.inject(STYLE_IDS.CUSTOM_CSS, css);
  }

  setTailwindCss(css: string): void {
    log.debug(`setTailwindCss called, length: ${css.length}`);
    StyleInjector.remove(STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS);
    if (!css.trim()) {
      StyleInjector.remove(STYLE_IDS.TAILWIND_CSS);
      return;
    }
    StyleInjector.inject(STYLE_IDS.TAILWIND_CSS, css, {
      insertBefore: STYLE_IDS.CUSTOM_CSS,
    });
  }

  setTailwindBrowserCss(css: string): void {
    log.debug(`setTailwindBrowserCss called, length: ${css.length}`);
    StyleInjector.remove(STYLE_IDS.TAILWIND_CSS);
    if (!css.trim()) {
      StyleInjector.remove(STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS);
      return;
    }

    StyleInjector.inject(STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS, css, {
      insertBefore: STYLE_IDS.CUSTOM_CSS,
      attributes: {
        type: 'text/tailwindcss',
      },
    });
  }

  // direct handler - load framework-specific shims on demand
  setFramework(framework: Framework): void {
    log.debug(`setFramework called: ${framework}`);
    // K.1: use cached module import to avoid repeated promise creation
    void getModuleSystem()
      .then(({ ensureFrameworkShimsLoaded }) => {
        ensureFrameworkShimsLoaded(framework);
      })
      .catch((err) => {
        log.error(`Failed to load framework shims for ${framework}:`, err);
      });
  }

  // direct handler - load specific generic shims on demand (conditional preloading)
  setUsedComponents(components: string[]): void {
    log.debug(`setUsedComponents called: ${components.join(', ')}`);
    // K.1: use cached module import to avoid repeated promise creation
    void getModuleSystem()
      .then(({ ensureGenericShimsLoaded }) => {
        ensureGenericShimsLoaded(components);
      })
      .catch((err) => {
        log.error('Failed to load generic shims:', err);
      });
  }

  // exception handler - async w/ dynamic import (kept manual)
  async invalidate(fsPath: string): Promise<void> {
    log.debug(`invalidate called: ${fsPath}`);
    // K.1: use cached module import to avoid repeated promise creation
    const { invalidateModule } = await getModuleSystem();
    invalidateModule(fsPath);
  }

  // clear all module & style caches (for manual cache refresh command)
  async clearAllCaches(): Promise<void> {
    log.debug('clearAllCaches called');
    const { clearAllCaches } = await getModuleSystem();
    clearAllCaches();
    // also clear any injected styles from DOM
    const styleElements = document.querySelectorAll('style[data-mdx-module]');
    styleElements.forEach((el) => el.remove());
    log.debug('clearAllCaches complete');
  }
}

// initialize RPC on webview side (set up bidirectional communication w/ extension)
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

// K.3: prevent double-registration during retry
let registrationInProgress = false;

// K.3: helper for exponential backoff retry
function attemptRegistration(
  handlers: WebviewStateHandlers,
  attempt: number
): void {
  registrationInProgress = true;

  try {
    stateHandlers = handlers;

    // warn if many messages accumulated (potential timing issue)
    // note: w/ coalescing, this is less likely but still possible w/ many message types
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
      // exponential backoff: 100ms, 200ms, 400ms, 800ms delays
      const delay = RPC_HANDLER_RETRY_DELAY_MS * Math.pow(2, attempt);
      log.debug(
        `Handler registration failed (attempt ${attempt + 1}), retrying in ${delay}ms...`
      );
      setTimeout(() => attemptRegistration(handlers, attempt + 1), delay);
    } else {
      registrationInProgress = false;
      log.error(`Handler registration failed after ${attempt + 1} attempts`, e);
    }
  }
}

// register React state handlers (called by App component on mount)
export function registerWebviewHandlers(handlers: WebviewStateHandlers): void {
  log.debug('registerWebviewHandlers called');

  // K.3: prevent duplicate registration during retry
  if (registrationInProgress) {
    log.debug('Registration already in progress, ignoring duplicate call');
    return;
  }

  attemptRegistration(handlers, 0);
}

// get extension handle for calling extension methods
export { extensionHandle as ExtensionHandle };

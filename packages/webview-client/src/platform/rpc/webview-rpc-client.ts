// packages/webview-client/src/platform/rpc/webview-rpc-client.ts
// RPC webview side - bidirectional communication between webview & extension via Comlink

import {
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
} from '../../app/constants';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import {
  LogTags,
  type ExtensionRPC,
  type WebviewRPC,
} from '@mdx-preview/contracts';
import {
  createHandlerFactories,
  type WebviewStateHandlers,
  SET_NEXTRA_META_CONFIG,
  SET_SHIM_SIDE_RAIL_CONFIG,
  SET_SOURCE_LINE_HIGHLIGHT_COLOR_CONFIG,
  SET_SOURCE_LINE_HIGHLIGHT_CONFIG,
  SET_STALE_CONFIG,
  SET_THEME_CONFIG,
  SET_TRUST_STATE_CONFIG,
  SHOW_PREVIEW_ERROR_CONFIG,
  UPDATE_PREVIEW_CONFIG,
  UPDATE_PREVIEW_SAFE_CONFIG,
} from './handler-factory';
import { bootstrapRpcWebviewSide } from './rpc-bootstrap';
import { createRpcDirectHandlers } from './rpc-direct-handlers';
import { createRpcMessageQueue } from './rpc-message-queue';
import { createRpcRegistration } from './rpc-registration';

const log = createTaggedLogger(LogTags.RPC_WEBVIEW);

export type ExtensionHandle = ExtensionRPC;

let stateHandlers: WebviewStateHandlers | null = null;
let extensionHandleRef: ExtensionHandle | null = null;

const queue = createRpcMessageQueue({
  log,
  getHandlers: () => stateHandlers,
});

const { createQueuedHandler, createOptionalHandler } = createHandlerFactories(
  () => stateHandlers,
  queue.enqueueQueued,
  queue.enqueueOptional
);

const directHandlers = createRpcDirectHandlers({ log });

class RPCWebviewHandle implements WebviewRPC {
  setTrustState = createQueuedHandler(SET_TRUST_STATE_CONFIG, log);
  updatePreview = createQueuedHandler(UPDATE_PREVIEW_CONFIG, log);
  updatePreviewSafe = createQueuedHandler(UPDATE_PREVIEW_SAFE_CONFIG, log);
  showPreviewError = createQueuedHandler(SHOW_PREVIEW_ERROR_CONFIG, log);
  setStale = createQueuedHandler(SET_STALE_CONFIG, log);

  setTheme = createOptionalHandler(SET_THEME_CONFIG, log);
  setNextraMeta = createOptionalHandler(SET_NEXTRA_META_CONFIG, log);
  setSourceLineHighlight = createOptionalHandler(
    SET_SOURCE_LINE_HIGHLIGHT_CONFIG,
    log
  );
  setSourceLineHighlightColor = createOptionalHandler(
    SET_SOURCE_LINE_HIGHLIGHT_COLOR_CONFIG,
    log
  );
  setShimSideRail = createOptionalHandler(SET_SHIM_SIDE_RAIL_CONFIG, log);

  setCustomCss = directHandlers.setCustomCss;
  setTailwindCss = directHandlers.setTailwindCss;
  setTailwindBrowserCss = directHandlers.setTailwindBrowserCss;
  setFramework = directHandlers.setFramework;
  setUsedComponents = directHandlers.setUsedComponents;
  invalidate = directHandlers.invalidate;
  clearAllCaches = directHandlers.clearAllCaches;
}

const rpcWebviewHandle = new RPCWebviewHandle();

const registration = createRpcRegistration({
  log,
  maxRetries: RPC_HANDLER_MAX_RETRIES,
  retryDelayMs: RPC_HANDLER_RETRY_DELAY_MS,
  warningThreshold: RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
  setHandlers: (handlers) => {
    stateHandlers = handlers;
  },
  flush: () => {
    queue.flush();
  },
  pendingCounts: queue.pendingCounts,
});

export function initRPCWebviewSide(): void {
  log.debug('initRPCWebviewSide called');

  const { extensionHandle } = bootstrapRpcWebviewSide({
    log,
    webviewHandle: rpcWebviewHandle,
  });

  extensionHandleRef = extensionHandle;
  log.debug('RPC webview bootstrap complete');
}

export function registerWebviewHandlers(handlers: WebviewStateHandlers): void {
  log.debug('registerWebviewHandlers called');
  registration.register(handlers);
}

function getInitializedExtensionHandle(): ExtensionHandle {
  if (extensionHandleRef) {
    return extensionHandleRef;
  }

  throw new Error(
    'ExtensionHandle is not initialized. Call initRPCWebviewSide() before using RPC methods.'
  );
}

export const ExtensionHandle: ExtensionHandle = {
  handshake(): void {
    getInitializedExtensionHandle().handshake();
  },
  reportPerformance(evaluationDuration: number): void {
    getInitializedExtensionHandle().reportPerformance(evaluationDuration);
  },
  fetch(request: string, isBare: boolean, parentId: string) {
    return getInitializedExtensionHandle().fetch(request, isBare, parentId);
  },
  openSettings(settingId?: string): void {
    getInitializedExtensionHandle().openSettings(settingId);
  },
  manageTrust(): void {
    getInitializedExtensionHandle().manageTrust();
  },
  openExternal(url: string): void {
    getInitializedExtensionHandle().openExternal(url);
  },
  openDocument(relativePath: string, line?: number, column?: number) {
    return getInitializedExtensionHandle().openDocument(
      relativePath,
      line,
      column
    );
  },
  openPreview(relativePath: string) {
    return getInitializedExtensionHandle().openPreview(relativePath);
  },
  renderPlantUml(code: string) {
    return getInitializedExtensionHandle().renderPlantUml(code);
  },
};

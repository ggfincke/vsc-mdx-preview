// packages/webview-client/src/platform/rpc/webview-rpc-client.ts
// RPC webview side - bidirectional communication between webview & extension via Comlink

import {
  RPC_HANDLER_RETRY_DELAY_MS,
  RPC_HANDLER_MAX_RETRIES,
  RPC_PENDING_MESSAGES_WARNING_THRESHOLD,
} from '../../app/constants';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { StyleInjector, STYLE_IDS } from '../../shared/utils/StyleInjector';
import {
  LogTags,
  type ExtensionRPC,
  type Framework,
  type WebviewRPC,
} from '@mdx-preview/contracts';
import {
  createHandlerFactories,
  type WebviewStateHandlers,
} from './handler-factory';
import { bootstrapRpcWebviewSide } from './rpc-bootstrap';
import { createRpcMessageQueue } from './rpc-message-queue';
import { createRpcRegistration } from './rpc-registration';
import { loadModuleSystem } from './module-system-loader';

const log = createTaggedLogger(LogTags.RPC_WEBVIEW);

export type ExtensionHandle = ExtensionRPC;

let stateHandlers: WebviewStateHandlers | null = null;
let extensionHandleRef: ExtensionHandle | null = null;

const queue = createRpcMessageQueue({
  log,
  getHandlers: () => stateHandlers,
});

const {
  createQueuedHandler,
  buildSimpleQueuedHandlers,
  buildOptionalHandlers,
} = createHandlerFactories(
  () => stateHandlers,
  queue.enqueueQueued,
  queue.enqueueOptional
);

// simple pass-through queued handlers (payload = first arg, handler gets [payload])
const simpleQueuedHandlers = buildSimpleQueuedHandlers(
  [
    {
      methodName: 'setTrustState',
      messageType: 'trust',
      handlerKey: 'setTrustState',
    },
    {
      methodName: 'showPreviewError',
      messageType: 'error',
      handlerKey: 'setError',
    },
    {
      methodName: 'setStale',
      messageType: 'stale',
      handlerKey: 'setStale',
      debugFormat: (isStale: unknown) => `setStale called: ${isStale}`,
    },
  ],
  log
);

// optional handlers (all follow the same name-as-key pattern)
const optionalHandlers = buildOptionalHandlers(
  [
    'setTheme',
    'setNextraMeta',
    'setSourceLineHighlight',
    'setSourceLineHighlightColor',
    'setShimSideRail',
  ],
  log
);

// custom queued handlers w/ payload transforms
const updatePreview = createQueuedHandler(
  {
    methodName: 'updatePreview',
    messageType: 'trusted',
    handlerKey: 'setTrustedContent',
    toPayload: (code: unknown, entryFilePath: unknown, deps: unknown) => ({
      code: code as string,
      entryFilePath: entryFilePath as string,
      dependencies: deps as string[],
    }),
    toHandlerArgs: (payload: {
      code: string;
      entryFilePath: string;
      dependencies: string[];
    }) => [payload.code, payload.entryFilePath, payload.dependencies],
    debugFormat: (code: unknown, entryFilePath: unknown) =>
      `updatePreview called, code length: ${(code as string).length}, path: ${entryFilePath}`,
  },
  log
);

const updatePreviewSafe = createQueuedHandler(
  {
    methodName: 'updatePreviewSafe',
    messageType: 'safe',
    handlerKey: 'setSafeContent',
    toPayload: (html: unknown) => ({ html: html as string }),
    toHandlerArgs: (payload: { html: string }) => [payload.html],
    debugFormat: (html: unknown) =>
      `updatePreviewSafe called, html length: ${(html as string).length}`,
  },
  log
);

// RPC handle implementing WebviewRPC w/ queued, optional, & direct handlers
class RPCWebviewHandle implements WebviewRPC {
  // queued handlers
  setTrustState = simpleQueuedHandlers.setTrustState;
  updatePreview = updatePreview;
  updatePreviewSafe = updatePreviewSafe;
  showPreviewError = simpleQueuedHandlers.showPreviewError;
  setStale = simpleQueuedHandlers.setStale;

  // optional handlers
  setTheme = optionalHandlers.setTheme;
  setNextraMeta = optionalHandlers.setNextraMeta;
  setSourceLineHighlight = optionalHandlers.setSourceLineHighlight;
  setSourceLineHighlightColor = optionalHandlers.setSourceLineHighlightColor;
  setShimSideRail = optionalHandlers.setShimSideRail;

  // direct handlers (execute immediately, no queuing)
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
      attributes: { type: 'text/tailwindcss' },
    });
  }

  setFramework(framework: Framework): void {
    log.debug(`setFramework called: ${framework}`);
    void loadModuleSystem()
      .then(({ ensureFrameworkShimsLoaded }) => {
        ensureFrameworkShimsLoaded(framework);
      })
      .catch((err) => {
        log.error(`Failed to load framework shims for ${framework}:`, err);
      });
  }

  setUsedComponents(components: string[]): void {
    log.debug(`setUsedComponents called: ${components.join(', ')}`);
    void loadModuleSystem()
      .then(({ ensureGenericShimsLoaded }) => {
        ensureGenericShimsLoaded(components);
      })
      .catch((err) => {
        log.error('Failed to load generic shims:', err);
      });
  }

  async invalidate(fsPath: string): Promise<void> {
    log.debug(`invalidate called: ${fsPath}`);
    const { invalidateModule } = await loadModuleSystem();
    invalidateModule(fsPath);
  }

  async clearAllCaches(): Promise<void> {
    log.debug('clearAllCaches called');
    const { clearAllCaches } = await loadModuleSystem();
    clearAllCaches();
    const styleElements = document.querySelectorAll('style[data-mdx-module]');
    styleElements.forEach((el) => el.remove());
    log.debug('clearAllCaches complete');
  }
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

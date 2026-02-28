// packages/webview-client/src/platform/rpc/handler-factory.ts
// factory functions & declarative configurations for RPC handler methods

import type {
  TaggedLogger,
  NextraPageMeta,
  PreviewError,
  SourceLineHighlightColorValue,
  TrustState,
  WebviewRPC,
  WebviewThemeState,
} from '@mdx-preview/contracts';

// message types for queued handlers (can be buffered until React mounts)
export type QueuedMessageType =
  | 'trust'
  | 'safe'
  | 'trusted'
  | 'error'
  | 'stale';

// required state handlers that must be registered by App component
export interface RequiredStateHandlers {
  setTrustState: (state: TrustState) => void;
  setSafeContent: (html: string) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: string[]
  ) => void;
  setError: (error: PreviewError) => void;
  setStale: (isStale: boolean) => void;
}

// optional state handlers that may or may not be registered
export interface OptionalStateHandlers {
  setTheme?: (state: WebviewThemeState) => void;
  setNextraMeta?: (meta: NextraPageMeta) => void;
  setFrontmatter?: (data: Record<string, unknown>) => void;
  setShowToc?: (show: boolean) => void;
  setSourceLineHighlight?: (enabled: boolean) => void;
  setSourceLineHighlightColor?: (mode: SourceLineHighlightColorValue) => void;
  setShimSideRail?: (enabled: boolean) => void;
}

// combined state handlers interface (required + optional)
export interface WebviewStateHandlers
  extends RequiredStateHandlers, OptionalStateHandlers {}

// configuration for a QUEUED pattern handler
export interface QueuedHandlerConfig<TPayload, THandlerArgs extends unknown[]> {
  // RPC method name (for debug logging)
  methodName: string;
  // message type for queue coalescing
  messageType: QueuedMessageType;
  // key in WebviewStateHandlers to call
  handlerKey: keyof RequiredStateHandlers;
  // transform RPC method args to queue payload
  toPayload: (...args: unknown[]) => TPayload;
  // transform payload back to handler args for flushing
  toHandlerArgs: (payload: TPayload) => THandlerArgs;
  // optional custom debug format (defaults to "methodName called")
  debugFormat?: (...args: unknown[]) => string;
}

// configuration for an OPTIONAL pattern handler
export interface OptionalHandlerConfig {
  // RPC method name (for debug logging)
  methodName: string;
  // key in OptionalStateHandlers to call
  handlerKey: keyof OptionalStateHandlers;
}

// pending optional message (buffer latest optional config until handlers mount)
export interface PendingOptionalMessage {
  handlerKey: keyof OptionalStateHandlers;
  args: unknown[];
}

// pending message structure for the queue (discriminated union)
export type PendingMessage =
  | { type: 'trust'; payload: unknown }
  | { type: 'safe'; payload: unknown }
  | { type: 'trusted'; payload: unknown }
  | { type: 'error'; payload: unknown }
  | { type: 'stale'; payload: unknown };

// create factory context bound to module-level state
export function createHandlerFactories(
  getHandlers: () => WebviewStateHandlers | null,
  enqueueFn: (msg: PendingMessage) => void,
  enqueueOptionalFn?: (msg: PendingOptionalMessage) => void
) {
  // create QUEUED pattern handler
  function createQueuedHandler<TPayload, THandlerArgs extends unknown[]>(
    config: QueuedHandlerConfig<TPayload, THandlerArgs>,
    log: TaggedLogger
  ): (...args: unknown[]) => void {
    const {
      methodName,
      messageType,
      handlerKey,
      toPayload,
      toHandlerArgs,
      debugFormat,
    } = config;

    return (...args: unknown[]): void => {
      // debug logging
      const msg = debugFormat ? debugFormat(...args) : `${methodName} called`;
      log.debug(
        msg,
        args.length === 1 ? args[0] : args.length > 1 ? args : undefined
      );

      const handlers = getHandlers();
      if (handlers) {
        // direct call - handlers are registered
        const payload = toPayload(...args);
        const handlerArgs = toHandlerArgs(payload);
        // Cast through unknown to avoid TypeScript's strict function signature checks
        const handler = handlers[handlerKey] as unknown as (
          ...a: THandlerArgs
        ) => void;
        handler(...handlerArgs);
        return;
      }

      // enqueue - handlers not yet registered
      enqueueFn({ type: messageType, payload: toPayload(...args) });
    };
  }

  // create OPTIONAL pattern handler
  function createOptionalHandler<TArgs extends unknown[]>(
    config: OptionalHandlerConfig,
    log: TaggedLogger
  ): (...args: TArgs) => void {
    const { methodName, handlerKey } = config;

    return (...args: TArgs): void => {
      // debug logging
      log.debug(
        `${methodName} called`,
        args.length === 1 ? args[0] : args.length > 1 ? args : undefined
      );

      const handlers = getHandlers();
      const handler = handlers?.[handlerKey];
      if (typeof handler === 'function') {
        (handler as (...a: TArgs) => void)(...args);
        return;
      }

      // optional handlers can arrive before React state handlers mount
      // buffer latest args so caller can replay after registration
      enqueueOptionalFn?.({ handlerKey, args: [...args] });
    };
  }

  return {
    createQueuedHandler,
    createOptionalHandler,
  };
}

// queued handler configurations

// factory for creating simple pass-through queued configs
// use for handlers where the payload is passed directly w/o transformation
function createSimpleQueuedConfig<T>(
  methodName: string,
  messageType: QueuedMessageType,
  handlerKey: keyof RequiredStateHandlers,
  debugFormat?: (...args: unknown[]) => string
): QueuedHandlerConfig<T, [T]> {
  return {
    methodName,
    messageType,
    handlerKey,
    toPayload: (value: unknown) => value as T,
    toHandlerArgs: (payload) => [payload],
    debugFormat,
  };
}

// configuration for setTrustState handler
export const SET_TRUST_STATE_CONFIG = createSimpleQueuedConfig<TrustState>(
  'setTrustState',
  'trust',
  'setTrustState'
);

// payload type for updatePreview
interface TrustedPayload {
  code: string;
  entryFilePath: string;
  dependencies: string[];
}

// configuration for updatePreview handler (Trusted Mode w/ compiled code)
export const UPDATE_PREVIEW_CONFIG: QueuedHandlerConfig<
  TrustedPayload,
  [string, string, string[]]
> = {
  methodName: 'updatePreview',
  messageType: 'trusted',
  handlerKey: 'setTrustedContent',
  toPayload: (
    code: unknown,
    entryFilePath: unknown,
    entryFileDependencies: unknown
  ) => ({
    code: code as string,
    entryFilePath: entryFilePath as string,
    dependencies: entryFileDependencies as string[],
  }),
  toHandlerArgs: (payload) => [
    payload.code,
    payload.entryFilePath,
    payload.dependencies,
  ],
  debugFormat: (code: unknown, entryFilePath: unknown) =>
    `updatePreview called, code length: ${(code as string).length}, path: ${entryFilePath}`,
};

// payload type for updatePreviewSafe
interface SafePayload {
  html: string;
}

// configuration for updatePreviewSafe handler (Safe Mode w/ sanitized HTML)
export const UPDATE_PREVIEW_SAFE_CONFIG: QueuedHandlerConfig<
  SafePayload,
  [string]
> = {
  methodName: 'updatePreviewSafe',
  messageType: 'safe',
  handlerKey: 'setSafeContent',
  toPayload: (html: unknown) => ({ html: html as string }),
  toHandlerArgs: (payload) => [payload.html],
  debugFormat: (html: unknown) =>
    `updatePreviewSafe called, html length: ${(html as string).length}`,
};

// configuration for showPreviewError handler
export const SHOW_PREVIEW_ERROR_CONFIG = createSimpleQueuedConfig<PreviewError>(
  'showPreviewError',
  'error',
  'setError'
);

// configuration for setStale handler
export const SET_STALE_CONFIG = createSimpleQueuedConfig<boolean>(
  'setStale',
  'stale',
  'setStale',
  (isStale: unknown) => `setStale called: ${isStale}`
);

// optional handler configurations

// configuration for setTheme handler
export const SET_THEME_CONFIG: OptionalHandlerConfig = {
  methodName: 'setTheme',
  handlerKey: 'setTheme',
};

// configuration for setNextraMeta handler
export const SET_NEXTRA_META_CONFIG: OptionalHandlerConfig = {
  methodName: 'setNextraMeta',
  handlerKey: 'setNextraMeta',
};

// configuration for setFrontmatter handler
export const SET_FRONTMATTER_CONFIG: OptionalHandlerConfig = {
  methodName: 'setFrontmatter',
  handlerKey: 'setFrontmatter',
};

// configuration for setShowToc handler
export const SET_SHOW_TOC_CONFIG: OptionalHandlerConfig = {
  methodName: 'setShowToc',
  handlerKey: 'setShowToc',
};

// configuration for setSourceLineHighlight handler
export const SET_SOURCE_LINE_HIGHLIGHT_CONFIG: OptionalHandlerConfig = {
  methodName: 'setSourceLineHighlight',
  handlerKey: 'setSourceLineHighlight',
};

// configuration for setSourceLineHighlightColor handler
export const SET_SOURCE_LINE_HIGHLIGHT_COLOR_CONFIG: OptionalHandlerConfig = {
  methodName: 'setSourceLineHighlightColor',
  handlerKey: 'setSourceLineHighlightColor',
};

// configuration for setShimSideRail handler
export const SET_SHIM_SIDE_RAIL_CONFIG: OptionalHandlerConfig = {
  methodName: 'setShimSideRail',
  handlerKey: 'setShimSideRail',
};

// config collections (for iteration/documentation)

// all QUEUED handler configurations
export const QUEUED_CONFIGS = {
  setTrustState: SET_TRUST_STATE_CONFIG,
  updatePreview: UPDATE_PREVIEW_CONFIG,
  updatePreviewSafe: UPDATE_PREVIEW_SAFE_CONFIG,
  showPreviewError: SHOW_PREVIEW_ERROR_CONFIG,
  setStale: SET_STALE_CONFIG,
} as const;

// all OPTIONAL handler configurations
export const OPTIONAL_CONFIGS = {
  setTheme: SET_THEME_CONFIG,
  setNextraMeta: SET_NEXTRA_META_CONFIG,
  setFrontmatter: SET_FRONTMATTER_CONFIG,
  setShowToc: SET_SHOW_TOC_CONFIG,
  setSourceLineHighlight: SET_SOURCE_LINE_HIGHLIGHT_CONFIG,
  setSourceLineHighlightColor: SET_SOURCE_LINE_HIGHLIGHT_COLOR_CONFIG,
  setShimSideRail: SET_SHIM_SIDE_RAIL_CONFIG,
} as const;

// compile-time type safety
// these types are derived from the configs above to ensure compile-time errors
// if handler configs & rpc-webview.ts get out of sync

// method names for QUEUED handlers (derived from QUEUED_CONFIGS keys)
export type QueuedMethodNames = keyof typeof QUEUED_CONFIGS;

// method names for OPTIONAL handlers (derived from OPTIONAL_CONFIGS keys)
export type OptionalMethodNames = keyof typeof OPTIONAL_CONFIGS;

// all configured RPC method names (queued & optional)
// does NOT include direct handlers (setCustomCss, setTailwindCss, etc.)
export type ConfiguredMethodNames = QueuedMethodNames | OptionalMethodNames;

// compile-time validation that all configured methods exist in WebviewRPC
type ValidateMethodExists<T extends string> = T extends keyof WebviewRPC
  ? true
  : never;

// force TypeScript to evaluate the validation
type _ValidateQueued = {
  [K in QueuedMethodNames]: ValidateMethodExists<K>;
};
type _ValidateOptional = {
  [K in OptionalMethodNames]: ValidateMethodExists<K>;
};

export type { _ValidateQueued, _ValidateOptional };

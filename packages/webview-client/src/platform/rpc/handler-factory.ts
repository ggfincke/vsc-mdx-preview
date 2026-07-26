// packages/webview-client/src/platform/rpc/handler-factory.ts
// factory functions for RPC handler methods (queued & optional patterns)

import type {
  TaggedLogger,
  ModuleDependency,
  NextraPageMeta,
  PreviewError,
  PreviewRuntimeConfig,
  TrustState,
  WebviewThemeState,
} from '@mdx-preview/contracts';

// message types for queued handlers (can be buffered until React mounts)
export type QueuedMessageType =
  'trust' | 'safe' | 'trusted' | 'error' | 'stale';

// required state handlers that must be registered by App component
export interface RequiredStateHandlers {
  setTrustState: (state: TrustState) => void;
  setSafeContent: (html: string) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: ModuleDependency[]
  ) => void;
  setError: (error: PreviewError) => void;
  setStale: (isStale: boolean) => void;
}

// optional state handlers that may or may not be registered
export interface OptionalStateHandlers {
  setTheme?: (state: WebviewThemeState) => void;
  setNextraMeta?: (meta: NextraPageMeta | null) => void;
  setRuntimeConfig?: (config: PreviewRuntimeConfig) => void;
  adjustZoom?: (delta: number) => void;
  resetZoom?: () => void;
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
  // preserve operations or coalesce state to the latest value
  queueMode?: 'latest' | 'all';
}

// buffer optional messages until handlers mount
export interface PendingOptionalMessage {
  handlerKey: keyof OptionalStateHandlers;
  args: unknown[];
  queueMode: 'latest' | 'all';
}

// pending message structure for the queue (discriminated union)
export type PendingMessage =
  | { type: 'trust'; payload: TrustState }
  | { type: 'safe'; payload: { html: string } }
  | {
      type: 'trusted';
      payload: {
        code: string;
        entryFilePath: string;
        dependencies: ModuleDependency[];
      };
    }
  | { type: 'error'; payload: PreviewError }
  | { type: 'stale'; payload: boolean };

interface QueuedHandlerFactoryOptions {
  onMessageReceived?: (message: PendingMessage) => void;
  shouldHandleDirectMessage?: (message: PendingMessage) => boolean;
  shouldDeferDirectMessage?: (message: PendingMessage) => boolean;
  onDirectMessageHandled?: (message: PendingMessage) => void;
}

// create factory context bound to module-level state
export function createHandlerFactories(
  getHandlers: () => WebviewStateHandlers | null,
  enqueueFn: (msg: PendingMessage) => void,
  enqueueOptionalFn?: (msg: PendingOptionalMessage) => void,
  options: QueuedHandlerFactoryOptions = {}
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
      const msg = debugFormat ? debugFormat(...args) : `${methodName} called`;
      log.debug(
        msg,
        args.length === 1 ? args[0] : args.length > 1 ? args : undefined
      );

      const payload = toPayload(...args);
      const message = { type: messageType, payload } as PendingMessage;
      options.onMessageReceived?.(message);

      const handlers = getHandlers();
      if (handlers) {
        if (options.shouldHandleDirectMessage?.(message) === false) {
          if (options.shouldDeferDirectMessage?.(message) === true) {
            enqueueFn(message);
          }
          return;
        }

        const handlerArgs = toHandlerArgs(payload);
        const handler = handlers[handlerKey] as unknown as (
          ...a: THandlerArgs
        ) => void;
        handler(...handlerArgs);
        options.onDirectMessageHandled?.(message);
        return;
      }

      enqueueFn(message);
    };
  }

  // create OPTIONAL pattern handler
  function createOptionalHandler<TArgs extends unknown[]>(
    config: OptionalHandlerConfig,
    log: TaggedLogger
  ): (...args: TArgs) => void {
    const { methodName, handlerKey } = config;

    return (...args: TArgs): void => {
      log.debug(
        `${methodName} called`,
        args.length === 1 ? args[0] : args.length > 1 ? args : undefined
      );

      const handlers = getHandlers();
      const handler = handlers?.[handlerKey];
      if (typeof handler === 'function') {
        Reflect.apply(handler, undefined, args);
        return;
      }

      enqueueOptionalFn?.({
        handlerKey,
        args: [...args],
        queueMode: config.queueMode ?? 'latest',
      });
    };
  }

  // batch-create simple queued handlers (pass-through payload pattern)
  function buildSimpleQueuedHandlers(
    configs: Array<{
      methodName: string;
      messageType: QueuedMessageType;
      handlerKey: keyof RequiredStateHandlers;
      debugFormat?: (...args: unknown[]) => string;
    }>,
    log: TaggedLogger
  ): Record<string, (...args: unknown[]) => void> {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    for (const config of configs) {
      handlers[config.methodName] = createQueuedHandler(
        {
          ...config,
          toPayload: (value: unknown) => value,
          toHandlerArgs: (payload) => [payload],
        },
        log
      );
    }
    return handlers;
  }

  // batch-create optional handlers from method names
  function buildOptionalHandlers(
    methodNames: Array<keyof OptionalStateHandlers>,
    log: TaggedLogger
  ): Record<string, (...args: unknown[]) => void> {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    for (const name of methodNames) {
      handlers[name] = createOptionalHandler(
        { methodName: name, handlerKey: name },
        log
      );
    }
    return handlers;
  }

  return {
    createQueuedHandler,
    createOptionalHandler,
    buildSimpleQueuedHandlers,
    buildOptionalHandlers,
  };
}

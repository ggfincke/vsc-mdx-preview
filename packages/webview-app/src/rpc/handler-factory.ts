// packages/webview-app/src/rpc/handler-factory.ts
// factory functions for creating RPC handler methods w/ consistent patterns

import type { TaggedLogger } from '../utils/debug';
import type {
  TrustState,
  PreviewError,
  WebviewThemeState,
  NextraPageMeta,
} from '@mdx-preview/shared';

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
  enqueueFn: (msg: PendingMessage) => void
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
      }
    };
  }

  return {
    createQueuedHandler,
    createOptionalHandler,
  };
}

// packages/webview-client/src/platform/rpc/rpc-message-queue.ts
// queued/optional message buffering & flush semantics for webview RPC

import type { TaggedLogger, TrustState } from '@mdx-preview/contracts';
import type {
  OptionalStateHandlers,
  PendingMessage,
  PendingOptionalMessage,
  QueuedMessageType,
  WebviewStateHandlers,
} from './handler-factory';
import { canAcceptContentMode } from './content-mode-guard';

// typed map accessor centralizing the union narrowing (Map.get does not narrow by key)
function getMsg<T extends QueuedMessageType>(
  messages: Map<QueuedMessageType, PendingMessage>,
  type: T
): Extract<PendingMessage, { type: T }> | undefined {
  return messages.get(type) as Extract<PendingMessage, { type: T }> | undefined;
}

export interface RpcMessageQueue {
  enqueueQueued: (message: PendingMessage) => void;
  enqueueOptional: (message: PendingOptionalMessage) => void;
  flush: () => void;
  pendingCounts: () => { queued: number; optional: number };
}

interface CreateRpcMessageQueueOptions {
  log: TaggedLogger;
  getHandlers: () => WebviewStateHandlers | null;
  getTrustState?: () => TrustState | null;
  onTrustStateChange?: (state: TrustState) => void;
}

export function createRpcMessageQueue(
  options: CreateRpcMessageQueueOptions
): RpcMessageQueue {
  const pendingMessages = new Map<QueuedMessageType, PendingMessage>();
  const pendingOptionalMessages = new Map<
    keyof OptionalStateHandlers,
    PendingOptionalMessage
  >();
  let fallbackTrustState: TrustState | null = null;

  function getCurrentTrustState(): TrustState | null {
    return options.getTrustState?.() ?? fallbackTrustState;
  }

  function setCurrentTrustState(state: TrustState): void {
    fallbackTrustState = state;
    options.onTrustStateChange?.(state);
  }

  function enqueueQueued(message: PendingMessage): void {
    const hadPrevious = pendingMessages.has(message.type);
    options.log.debug(
      `Enqueueing message: ${message.type}${hadPrevious ? ' (replacing previous)' : ''}`
    );
    pendingMessages.set(message.type, message);
  }

  function enqueueOptional(message: PendingOptionalMessage): void {
    const hadPrevious = pendingOptionalMessages.has(message.handlerKey);
    options.log.debug(
      `Enqueueing optional message: ${String(message.handlerKey)}${
        hadPrevious ? ' (replacing previous)' : ''
      }`
    );
    pendingOptionalMessages.set(message.handlerKey, message);
  }

  function flushQueued(handlers: WebviewStateHandlers): void {
    options.log.debug(`flushPendingMessages: ${pendingMessages.size} pending`);
    if (pendingMessages.size === 0) {
      return;
    }

    const messages = new Map(pendingMessages);
    pendingMessages.clear();

    const trustMessage = getMsg(messages, 'trust');
    if (trustMessage) {
      options.log.debug('Flushing trust state first');
      const trust = trustMessage.payload;
      setCurrentTrustState(trust);
      handlers.setTrustState(trust);
    }

    const safeMsg = getMsg(messages, 'safe');
    const trustedMsg = getMsg(messages, 'trusted');

    if (safeMsg && trustedMsg) {
      options.log.warn(
        'Both safe & trusted content queued - selecting based on trust'
      );
      if (getCurrentTrustState()?.canExecute) {
        flushTrusted(handlers, trustedMsg.payload);
      } else {
        options.log.debug('Flushing safe content (safe mode active)');
        handlers.setSafeContent(safeMsg.payload.html);
      }
    } else if (trustedMsg) {
      flushTrusted(handlers, trustedMsg.payload);
    } else if (safeMsg) {
      options.log.debug('Flushing safe content');
      handlers.setSafeContent(safeMsg.payload.html);
    }

    const errorMsg = getMsg(messages, 'error');
    if (errorMsg) {
      options.log.debug('Flushing error');
      handlers.setError(errorMsg.payload);
    }

    const staleMsg = getMsg(messages, 'stale');
    if (staleMsg) {
      options.log.debug('Flushing stale');
      handlers.setStale(staleMsg.payload);
    }
  }

  function flushOptional(handlers: WebviewStateHandlers): void {
    options.log.debug(
      `flushPendingOptionalMessages: ${pendingOptionalMessages.size} pending`
    );
    if (pendingOptionalMessages.size === 0) {
      return;
    }

    const messages = new Map(pendingOptionalMessages);
    pendingOptionalMessages.clear();

    for (const [handlerKey, message] of messages) {
      const handler = handlers[handlerKey];
      if (typeof handler !== 'function') {
        continue;
      }

      (handler as (...args: unknown[]) => void)(...message.args);
    }
  }

  function flushTrusted(
    handlers: WebviewStateHandlers,
    payload: Extract<PendingMessage, { type: 'trusted' }>['payload']
  ): void {
    if (!canAcceptContentMode(getCurrentTrustState(), 'trusted', options.log)) {
      return;
    }

    options.log.debug('Flushing trusted content');
    handlers.setTrustedContent(
      payload.code,
      payload.entryFilePath,
      payload.dependencies
    );
  }

  function flush(): void {
    const handlers = options.getHandlers();
    if (!handlers) {
      return;
    }

    flushQueued(handlers);
    flushOptional(handlers);
  }

  function pendingCounts(): { queued: number; optional: number } {
    return {
      queued: pendingMessages.size,
      optional: pendingOptionalMessages.size,
    };
  }

  return {
    enqueueQueued,
    enqueueOptional,
    flush,
    pendingCounts,
  };
}

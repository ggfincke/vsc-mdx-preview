// packages/webview-client/src/platform/rpc/rpc-message-queue.ts
// queued/optional message buffering & flush semantics for webview RPC

import type {
  TaggedLogger,
  PreviewError,
  TrustState,
} from '@mdx-preview/contracts';
import type {
  OptionalStateHandlers,
  PendingMessage,
  PendingOptionalMessage,
  QueuedMessageType,
  WebviewStateHandlers,
} from './handler-factory';
import { canAcceptContentMode } from './content-mode-guard';

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

    const trustMessage = messages.get('trust');
    if (trustMessage) {
      options.log.debug('Flushing trust state first');
      setCurrentTrustState(trustMessage.payload as TrustState);
      handlers.setTrustState(getCurrentTrustState() as TrustState);
    }

    const safeMsg = messages.get('safe');
    const trustedMsg = messages.get('trusted');

    if (safeMsg && trustedMsg) {
      options.log.warn(
        'Both safe & trusted content queued - selecting based on trust'
      );
      if (getCurrentTrustState()?.canExecute) {
        flushTrusted(handlers, trustedMsg.payload);
      } else {
        options.log.debug('Flushing safe content (safe mode active)');
        handlers.setSafeContent((safeMsg.payload as { html: string }).html);
      }
    } else if (trustedMsg) {
      flushTrusted(handlers, trustedMsg.payload);
    } else if (safeMsg) {
      options.log.debug('Flushing safe content');
      handlers.setSafeContent((safeMsg.payload as { html: string }).html);
    }

    const errorMsg = messages.get('error');
    if (errorMsg) {
      options.log.debug('Flushing error');
      handlers.setError(errorMsg.payload as PreviewError);
    }

    const staleMsg = messages.get('stale');
    if (staleMsg) {
      options.log.debug('Flushing stale');
      handlers.setStale(staleMsg.payload as boolean);
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
    payload: unknown
  ): void {
    if (!canAcceptContentMode(getCurrentTrustState(), 'trusted', options.log)) {
      return;
    }

    const trustedPayload = payload as {
      code: string;
      entryFilePath: string;
      dependencies: string[];
    };

    options.log.debug('Flushing trusted content');
    handlers.setTrustedContent(
      trustedPayload.code,
      trustedPayload.entryFilePath,
      trustedPayload.dependencies
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

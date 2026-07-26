// packages/webview-client/src/platform/rpc/rpc-message-queue.ts
// queued/optional message buffering & flush semantics for webview RPC

import type { TaggedLogger, TrustState } from '@mdx-preview/contracts';
import type {
  PendingMessage,
  PendingOptionalMessage,
  QueuedMessageType,
  WebviewStateHandlers,
} from './handler-factory';
import { canAcceptContentMode } from './content-mode-guard';

type PendingPreviewOutcome = Extract<
  PendingMessage,
  { type: 'safe' | 'trusted' | 'error' }
>;

// typed map accessor centralizing the union narrowing (Map.get does not narrow by key)
function getMsg<T extends QueuedMessageType>(
  messages: Map<QueuedMessageType, PendingMessage>,
  type: T
): Extract<PendingMessage, { type: T }> | undefined {
  return messages.get(type) as Extract<PendingMessage, { type: T }> | undefined;
}

function isPreviewOutcome(
  message: PendingMessage
): message is PendingPreviewOutcome {
  return (
    message.type === 'safe' ||
    message.type === 'trusted' ||
    message.type === 'error'
  );
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
  let pendingPreviewOutcome: PendingPreviewOutcome | null = null;
  let pendingOptionalMessages: PendingOptionalMessage[] = [];
  let fallbackTrustState: TrustState | null = null;

  function getCurrentTrustState(): TrustState | null {
    return options.getTrustState?.() ?? fallbackTrustState;
  }

  function setCurrentTrustState(state: TrustState): void {
    fallbackTrustState = state;
    options.onTrustStateChange?.(state);
  }

  function enqueueQueued(message: PendingMessage): void {
    if (isPreviewOutcome(message)) {
      const hadPrevious = pendingPreviewOutcome !== null;
      options.log.debug(
        `Enqueueing preview outcome: ${message.type}${
          hadPrevious ? ' (replacing previous)' : ''
        }`
      );
      pendingPreviewOutcome = message;
      return;
    }

    const hadPrevious = pendingMessages.has(message.type);
    options.log.debug(
      `Enqueueing message: ${message.type}${hadPrevious ? ' (replacing previous)' : ''}`
    );
    pendingMessages.set(message.type, message);
  }

  function enqueueOptional(message: PendingOptionalMessage): void {
    const previousCount = pendingOptionalMessages.length;
    if (message.queueMode === 'latest') {
      pendingOptionalMessages = pendingOptionalMessages.filter(
        (pending) => pending.handlerKey !== message.handlerKey
      );
    }
    const hadPrevious =
      message.queueMode === 'latest' &&
      pendingOptionalMessages.length !== previousCount;
    options.log.debug(
      `Enqueueing optional message: ${String(message.handlerKey)}${
        hadPrevious ? ' (replacing previous)' : ''
      }`
    );
    pendingOptionalMessages.push(message);
  }

  function flushQueued(handlers: WebviewStateHandlers): void {
    const pendingCount =
      pendingMessages.size + (pendingPreviewOutcome === null ? 0 : 1);
    options.log.debug(`flushPendingMessages: ${pendingCount} pending`);
    if (pendingCount === 0) {
      return;
    }

    const messages = new Map(pendingMessages);
    const previewOutcome = pendingPreviewOutcome;
    pendingMessages.clear();
    pendingPreviewOutcome = null;

    const trustMessage = getMsg(messages, 'trust');
    if (trustMessage) {
      options.log.debug('Flushing trust state first');
      const trust = trustMessage.payload;
      setCurrentTrustState(trust);
      handlers.setTrustState(trust);
    }

    if (previewOutcome?.type === 'safe') {
      options.log.debug('Flushing safe content');
      handlers.setSafeContent(previewOutcome.payload.html);
    } else if (previewOutcome?.type === 'trusted') {
      if (!flushTrusted(handlers, previewOutcome.payload)) {
        pendingPreviewOutcome = previewOutcome;
      }
    } else if (previewOutcome?.type === 'error') {
      options.log.debug('Flushing error');
      handlers.setError(previewOutcome.payload);
    }

    const staleMsg = getMsg(messages, 'stale');
    if (staleMsg) {
      options.log.debug('Flushing stale');
      handlers.setStale(staleMsg.payload);
    }
  }

  function flushOptional(handlers: WebviewStateHandlers): void {
    options.log.debug(
      `flushPendingOptionalMessages: ${pendingOptionalMessages.length} pending`
    );
    if (pendingOptionalMessages.length === 0) {
      return;
    }

    const messages = pendingOptionalMessages;
    pendingOptionalMessages = [];

    for (const message of messages) {
      const handler = handlers[message.handlerKey];
      if (typeof handler !== 'function') {
        continue;
      }

      (handler as (...args: unknown[]) => void)(...message.args);
    }
  }

  function flushTrusted(
    handlers: WebviewStateHandlers,
    payload: Extract<PendingMessage, { type: 'trusted' }>['payload']
  ): boolean {
    const trustState = getCurrentTrustState();
    if (!trustState) {
      options.log.debug('Deferring trusted content until trust state');
      return false;
    }

    if (!canAcceptContentMode(trustState, 'trusted', options.log)) {
      return true;
    }

    options.log.debug('Flushing trusted content');
    handlers.setTrustedContent(
      payload.code,
      payload.entryFilePath,
      payload.dependencies
    );
    return true;
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
      queued: pendingMessages.size + (pendingPreviewOutcome === null ? 0 : 1),
      optional: pendingOptionalMessages.length,
    };
  }

  return {
    enqueueQueued,
    enqueueOptional,
    flush,
    pendingCounts,
  };
}

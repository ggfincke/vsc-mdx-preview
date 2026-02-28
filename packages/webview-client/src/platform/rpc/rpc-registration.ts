// packages/webview-client/src/platform/rpc/rpc-registration.ts
// registration retry/backoff orchestration for webview state handlers

import type { TaggedLogger } from '@mdx-preview/contracts';
import type { WebviewStateHandlers } from './handler-factory';

export interface RpcRegistration {
  register: (handlers: WebviewStateHandlers) => void;
  isInProgress: () => boolean;
}

interface CreateRpcRegistrationOptions {
  log: TaggedLogger;
  maxRetries: number;
  retryDelayMs: number;
  warningThreshold: number;
  setHandlers: (handlers: WebviewStateHandlers) => void;
  flush: () => void;
  pendingCounts: () => { queued: number; optional: number };
}

export function createRpcRegistration(
  options: CreateRpcRegistrationOptions
): RpcRegistration {
  let registrationInProgress = false;

  function attemptRegistration(
    handlers: WebviewStateHandlers,
    attempt: number
  ): void {
    registrationInProgress = true;

    try {
      options.setHandlers(handlers);

      const { queued } = options.pendingCounts();
      if (queued > options.warningThreshold) {
        options.log.error(`Warning: ${queued} pending messages accumulated`);
      }

      options.flush();
      registrationInProgress = false;
      options.log.debug('registerWebviewHandlers complete');
    } catch (error) {
      if (attempt < options.maxRetries) {
        const delay = options.retryDelayMs * Math.pow(2, attempt);
        options.log.debug(
          `Handler registration failed (attempt ${attempt + 1}), retrying in ${delay}ms...`
        );
        setTimeout(() => attemptRegistration(handlers, attempt + 1), delay);
        return;
      }

      registrationInProgress = false;
      options.log.error(
        `Handler registration failed after ${attempt + 1} attempts`,
        error
      );
    }
  }

  function register(handlers: WebviewStateHandlers): void {
    if (registrationInProgress) {
      options.log.debug(
        'Registration already in progress, ignoring duplicate call'
      );
      return;
    }

    attemptRegistration(handlers, 0);
  }

  return {
    register,
    isInProgress: () => registrationInProgress,
  };
}

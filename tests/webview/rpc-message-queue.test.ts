// tests/webview/rpc-message-queue.test.ts
// unit tests for RPC message queue buffering & flush order

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebviewStateHandlers } from '../../packages/webview-client/src/platform/rpc/handler-factory';
import { createRpcMessageQueue } from '../../packages/webview-client/src/platform/rpc/rpc-message-queue';

function createHandlers(): WebviewStateHandlers {
  return {
    setTrustState: vi.fn(),
    setSafeContent: vi.fn(),
    setTrustedContent: vi.fn(),
    setError: vi.fn(),
    setStale: vi.fn(),
    setTheme: vi.fn(),
    setNextraMeta: vi.fn(),
    setFrontmatter: vi.fn(),
    setShowToc: vi.fn(),
    setSourceLineHighlight: vi.fn(),
    setSourceLineHighlightColor: vi.fn(),
    setShimSideRail: vi.fn(),
  };
}

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('createRpcMessageQueue', () => {
  let handlers: WebviewStateHandlers | null;

  beforeEach(() => {
    handlers = null;
  });

  it('coalesces queued messages by message type', () => {
    const queue = createRpcMessageQueue({
      log: createLogger(),
      getHandlers: () => handlers,
    });

    queue.enqueueQueued({ type: 'stale', payload: true });
    queue.enqueueQueued({ type: 'stale', payload: false });

    expect(queue.pendingCounts().queued).toBe(1);
  });

  it('flushes trust first then content and overlays', () => {
    const logger = createLogger();
    handlers = createHandlers();
    const queue = createRpcMessageQueue({
      log: logger,
      getHandlers: () => handlers,
    });

    queue.enqueueQueued({
      type: 'trusted',
      payload: {
        code: 'code',
        entryFilePath: '/doc.mdx',
        dependencies: [],
      },
    });
    queue.enqueueQueued({
      type: 'trust',
      payload: {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
        openMdxLinksInPreview: false,
      },
    });
    queue.enqueueQueued({
      type: 'error',
      payload: { message: 'boom', type: 'compile' },
    });

    queue.flush();

    const trustOrder = (handlers.setTrustState as any).mock
      .invocationCallOrder[0];
    const trustedOrder = (handlers.setTrustedContent as any).mock
      .invocationCallOrder[0];
    const errorOrder = (handlers.setError as any).mock.invocationCallOrder[0];

    expect(trustOrder).toBeLessThan(trustedOrder);
    expect(trustedOrder).toBeLessThan(errorOrder);
  });

  it('selects trusted content when both safe and trusted are queued in trusted mode', () => {
    handlers = createHandlers();
    const queue = createRpcMessageQueue({
      log: createLogger(),
      getHandlers: () => handlers,
    });

    queue.enqueueQueued({
      type: 'trust',
      payload: {
        workspaceTrusted: true,
        scriptsEnabled: true,
        canExecute: true,
        openMdxLinksInPreview: false,
      },
    });
    queue.enqueueQueued({ type: 'safe', payload: { html: '<p>safe</p>' } });
    queue.enqueueQueued({
      type: 'trusted',
      payload: {
        code: 'trusted',
        entryFilePath: '/doc.mdx',
        dependencies: [],
      },
    });

    queue.flush();

    expect(handlers!.setTrustedContent).toHaveBeenCalledTimes(1);
    expect(handlers!.setSafeContent).not.toHaveBeenCalled();
  });

  it('discards trusted content when trust state cannot execute', () => {
    const logger = createLogger();
    handlers = createHandlers();
    const queue = createRpcMessageQueue({
      log: logger,
      getHandlers: () => handlers,
    });

    queue.enqueueQueued({
      type: 'trust',
      payload: {
        workspaceTrusted: true,
        scriptsEnabled: false,
        canExecute: false,
        openMdxLinksInPreview: false,
      },
    });
    queue.enqueueQueued({
      type: 'trusted',
      payload: {
        code: 'trusted',
        entryFilePath: '/doc.mdx',
        dependencies: [],
      },
    });

    queue.flush();

    expect(handlers!.setTrustedContent).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Discarding trusted content')
    );
  });

  it('coalesces optional messages and replays latest value on flush', () => {
    handlers = createHandlers();
    const queue = createRpcMessageQueue({
      log: createLogger(),
      getHandlers: () => handlers,
    });

    queue.enqueueOptional({ handlerKey: 'setShowToc', args: [true] });
    queue.enqueueOptional({ handlerKey: 'setShowToc', args: [false] });
    queue.enqueueOptional({ handlerKey: 'setShimSideRail', args: [false] });

    expect(queue.pendingCounts().optional).toBe(2);

    queue.flush();

    expect(handlers!.setShowToc).toHaveBeenCalledWith(false);
    expect(handlers!.setShimSideRail).toHaveBeenCalledWith(false);
    expect(queue.pendingCounts().optional).toBe(0);
  });
});

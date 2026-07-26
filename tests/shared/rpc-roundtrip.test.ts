// tests/shared/rpc-roundtrip.test.ts
// verify real Comlink traffic across extension & webview endpoint adapters
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import * as comlink from 'comlink';

import { initRPCExtensionSide } from '../../packages/extension-host/src/platform/rpc/extension-endpoint';
import { bootstrapRpcWebviewSide } from '../../packages/webview-client/src/platform/rpc/rpc-bootstrap';

type ExtensionListener = (message: unknown) => void;
type WindowListener = EventListenerOrEventListenerObject;

const silentLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

class InMemoryVsCodeMessageBus {
  private pendingDelivery = Promise.resolve();
  private readonly extensionListeners = new Set<ExtensionListener>();
  private readonly extensionDisposables: Array<{ dispose(): void }> = [];
  private readonly windowListeners = new Set<WindowListener>();

  readonly webview = {
    postMessage: (message: unknown): Promise<boolean> => {
      this.enqueue(() => {
        window.dispatchEvent(new MessageEvent('message', { data: message }));
      });
      return Promise.resolve(true);
    },
    onDidReceiveMessage: (
      listener: ExtensionListener,
      _thisArg?: unknown,
      disposables?: Array<{ dispose(): void }>
    ) => {
      this.extensionListeners.add(listener);
      const disposable = {
        dispose: () => {
          this.extensionListeners.delete(listener);
        },
      };
      disposables?.push(disposable);
      return disposable;
    },
  };

  readonly vscodeApi = {
    postMessage: (message: unknown): void => {
      this.enqueue(() => {
        for (const listener of this.extensionListeners) {
          // the production extension endpoint adds the VS Code {data} envelope
          listener(message);
        }
      });
    },
    getState: (): unknown => undefined,
    setState: (_state: unknown): void => undefined,
  };

  readonly windowEventTarget = {
    addEventListener: (
      type: string,
      listener: WindowListener,
      options?: boolean | AddEventListenerOptions
    ): void => {
      window.addEventListener(type, listener, options);
      if (type === 'message') {
        this.windowListeners.add(listener);
      }
    },
    removeEventListener: (
      type: string,
      listener: WindowListener,
      options?: boolean | EventListenerOptions
    ): void => {
      window.removeEventListener(type, listener, options);
      if (type === 'message') {
        this.windowListeners.delete(listener);
      }
    },
  };

  get disposables(): Array<{ dispose(): void }> {
    return this.extensionDisposables;
  }

  async settle(): Promise<void> {
    let observedDelivery: Promise<void>;
    do {
      observedDelivery = this.pendingDelivery;
      await observedDelivery;
    } while (observedDelivery !== this.pendingDelivery);
  }

  dispose(): void {
    for (const disposable of this.extensionDisposables.splice(0)) {
      disposable.dispose();
    }
    for (const listener of this.windowListeners) {
      window.removeEventListener('message', listener);
    }
    this.windowListeners.clear();
  }

  private enqueue(deliver: () => void): void {
    this.pendingDelivery = this.pendingDelivery.then(deliver);
  }
}

function connectRpcAdapters() {
  const meta = document.createElement('meta');
  meta.name = 'mdx-preview-handshake-id';
  meta.content = '73';
  document.head.append(meta);

  const bus = new InMemoryVsCodeMessageBus();
  const completeHandshake = vi.fn(() => true);
  const updatePreview = vi.fn();
  const preview = {
    completeHandshake,
  } as unknown as Parameters<typeof initRPCExtensionSide>[0];
  const webviewHandle = {
    updatePreview,
  } as unknown as Parameters<
    typeof bootstrapRpcWebviewSide
  >[0]['webviewHandle'];

  const webviewRemote = initRPCExtensionSide(
    preview,
    bus.webview as unknown as Parameters<typeof initRPCExtensionSide>[1],
    bus.disposables as Parameters<typeof initRPCExtensionSide>[2],
    vi.fn(async () => {})
  );

  bootstrapRpcWebviewSide({
    log: silentLogger,
    webviewHandle,
    acquireVsCodeApiFn: () => bus.vscodeApi,
    comlinkApi: comlink,
    eventTarget: bus.windowEventTarget as Parameters<
      typeof bootstrapRpcWebviewSide
    >[0]['eventTarget'],
  });

  return {
    bus,
    completeHandshake,
    meta,
    updatePreview,
    webviewRemote,
  };
}

describe('RPC transport round trip', () => {
  it('delivers the meta handshake ID to the extension preview', async () => {
    const scenario = connectRpcAdapters();

    try {
      await scenario.bus.settle();

      expect(scenario.completeHandshake).toHaveBeenCalledTimes(1);
      expect(scenario.completeHandshake).toHaveBeenCalledWith(73);
    } finally {
      scenario.bus.dispose();
      scenario.meta.remove();
    }
  });

  it('delivers extension preview updates to the exposed webview handle', async () => {
    const scenario = connectRpcAdapters();

    try {
      await scenario.webviewRemote.updatePreview(
        'NEW_CODE',
        'C:/repo/doc.mdx',
        ['C:/repo/dep.ts']
      );

      expect(scenario.updatePreview).toHaveBeenCalledTimes(1);
      expect(scenario.updatePreview).toHaveBeenCalledWith(
        'NEW_CODE',
        'C:/repo/doc.mdx',
        ['C:/repo/dep.ts']
      );
    } finally {
      scenario.bus.dispose();
      scenario.meta.remove();
    }
  });
});

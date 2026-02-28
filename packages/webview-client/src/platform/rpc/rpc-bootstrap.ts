// packages/webview-client/src/platform/rpc/rpc-bootstrap.ts
// Comlink bootstrap & endpoint adapter for VS Code webview RPC

import * as comlink from 'comlink';
import type { Endpoint } from 'comlink';
import type {
  ExtensionRPC,
  TaggedLogger,
  WebviewRPC,
} from '@mdx-preview/contracts';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

type AcquireVsCodeApi = () => VsCodeApi;

type EventTargetLike = Pick<
  typeof globalThis,
  'addEventListener' | 'removeEventListener'
>;

export interface RpcBootstrapResult {
  extensionHandle: ExtensionRPC;
  endpoint: Endpoint;
}

interface RpcBootstrapOptions {
  log: TaggedLogger;
  webviewHandle: WebviewRPC;
  acquireVsCodeApiFn?: AcquireVsCodeApi;
  comlinkApi?: Pick<typeof comlink, 'wrap' | 'expose'>;
  eventTarget?: EventTargetLike;
}

declare const acquireVsCodeApi: AcquireVsCodeApi;

class WebviewProxy implements Endpoint {
  constructor(
    private readonly vscodeApi: VsCodeApi,
    private readonly eventTarget: EventTargetLike,
    private readonly log: TaggedLogger
  ) {}

  postMessage(message: unknown): void {
    this.log.debug('postMessage to extension');
    this.vscodeApi.postMessage(message);
  }

  addEventListener(...args: Parameters<EventTargetLike['addEventListener']>) {
    this.eventTarget.addEventListener(...args);
  }

  removeEventListener(
    ...args: Parameters<EventTargetLike['removeEventListener']>
  ) {
    this.eventTarget.removeEventListener(...args);
  }
}

export function bootstrapRpcWebviewSide(
  options: RpcBootstrapOptions
): RpcBootstrapResult {
  const acquireApi =
    options.acquireVsCodeApiFn ??
    (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi : undefined);

  if (!acquireApi) {
    throw new Error('acquireVsCodeApi is not available');
  }

  const eventTarget =
    options.eventTarget ??
    (typeof globalThis.addEventListener === 'function' &&
    typeof globalThis.removeEventListener === 'function'
      ? globalThis
      : undefined);
  if (!eventTarget) {
    throw new Error('No event target available for webview RPC bootstrap');
  }
  const comlinkApi = options.comlinkApi ?? comlink;

  const vscodeApi = acquireApi();
  const endpoint = new WebviewProxy(vscodeApi, eventTarget, options.log);
  const extensionHandle = comlinkApi.wrap<ExtensionRPC>(endpoint);

  comlinkApi.expose(options.webviewHandle, endpoint);
  extensionHandle.handshake();

  return {
    extensionHandle,
    endpoint,
  };
}

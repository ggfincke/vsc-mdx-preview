// packages/extension-host/src/platform/rpc/extension-endpoint.ts
// RPC communication between extension & webview via Comlink

import * as comlink from 'comlink';
import type { Endpoint, Remote } from 'comlink';
import * as vscode from 'vscode';
import type { WebviewRPC } from '@mdx-preview/contracts';
import { LogTags } from '@mdx-preview/contracts';

import ExtensionHandle from './extension-rpc-handler';
import type { Preview } from '../../features/preview/Preview';
import { createTaggedLogger } from '../../shared/logging/logger';

const log = createTaggedLogger(LogTags.RPC_EXT);

type AllowedTypeForComlink = 'message';

// event listener compatible w/ Comlink's Endpoint (Node.js extension host)
type EventListenerCallback = (event: { data: unknown }) => void;
interface EventListenerObject {
  handleEvent(event: { data: unknown }): void;
}
type EventListenerOrEventListenerObject =
  EventListenerCallback | EventListenerObject;

class ExtensionEndpoint implements Endpoint {
  webview: vscode.Webview;
  disposables: vscode.Disposable[];
  disposeEventListener?: vscode.Disposable;
  currentListener?: EventListenerOrEventListenerObject;

  constructor(webview: vscode.Webview, disposables: vscode.Disposable[]) {
    log.debug('ExtensionEndpoint created');
    this.webview = webview;
    this.disposables = disposables;
  }

  postMessage(message: unknown): void {
    log.debug('postMessage called');
    this.webview.postMessage(message);
  }

  addEventListener(
    _type: AllowedTypeForComlink,
    listener: EventListenerOrEventListenerObject
  ): void {
    log.debug('addEventListener called');
    this.currentListener = listener;
    this.disposeEventListener = this.webview.onDidReceiveMessage(
      (message) => {
        log.debug('Received message from webview');
        const messageEvent = { data: message };
        if (typeof listener === 'function') {
          listener(messageEvent);
        } else {
          listener.handleEvent(messageEvent);
        }
      },
      null,
      this.disposables
    );
  }

  removeEventListener(
    _type: AllowedTypeForComlink,
    listener: EventListenerOrEventListenerObject
  ): void {
    log.debug('removeEventListener called');
    if (this.currentListener === listener && this.disposeEventListener) {
      this.disposeEventListener.dispose();
    }
  }
}

export type WebviewHandleType = Remote<WebviewRPC>;

// initialize RPC on extension side
export function initRPCExtensionSide(
  preview: Preview,
  webview: vscode.Webview,
  disposables: vscode.Disposable[],
  openPreview: () => Promise<void>
): WebviewHandleType {
  log.debug('initRPCExtensionSide called');
  const extensionEndpoint = new ExtensionEndpoint(webview, disposables);

  // webview to extension calls
  log.debug('Creating ExtensionHandle');
  const handle = new ExtensionHandle(preview, openPreview);
  log.debug('Exposing ExtensionHandle via comlink');
  comlink.expose(handle, extensionEndpoint);

  // extension to webview calls
  log.debug('Wrapping WebviewHandle via comlink');
  const WebviewHandle = comlink.wrap<WebviewRPC>(extensionEndpoint);
  log.debug('initRPCExtensionSide complete');
  return WebviewHandle;
}

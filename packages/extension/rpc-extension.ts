// packages/extension/rpc-extension.ts
// RPC communication between extension & webview via Comlink

import * as comlink from 'comlink';
import type { Endpoint, Remote } from 'comlink';
import * as vscode from 'vscode';

import ExtensionHandle from './rpc-extension-handle';
import { Preview } from './preview/preview-manager';
import type { WebviewRPC } from '@mdx-preview/shared-types';
import { debug } from './logging';

type AllowedTypeForComlink = 'message';

// event listener compatible w/ Comlink's Endpoint (Node.js extension host)
type EventListenerCallback = (event: { data: unknown }) => void;
interface EventListenerObject {
  handleEvent(event: { data: unknown }): void;
}
type EventListenerOrEventListenerObject =
  | EventListenerCallback
  | EventListenerObject;

// minimal MessageEvent-like interface for Comlink compatibility
interface MessageEvent {
  data: unknown;
}

// webview-side handle (methods extension can call)
// type alias for shared WebviewRPC (used by Comlink)
export type WebviewRemoteHandle = WebviewRPC;

class ExtensionEndpoint implements Endpoint {
  webview: vscode.Webview;
  disposables: vscode.Disposable[];
  disposeEventListener?: vscode.Disposable;
  currentListener?: EventListenerOrEventListenerObject;

  constructor(webview: vscode.Webview, disposables: vscode.Disposable[]) {
    debug('[RPC-EXT] ExtensionEndpoint created');
    this.webview = webview;
    this.disposables = disposables;
  }

  postMessage(message: unknown): void {
    debug('[RPC-EXT] postMessage called');
    this.webview.postMessage(message);
  }

  addEventListener(
    _type: AllowedTypeForComlink,
    listener: EventListenerOrEventListenerObject
  ): void {
    debug('[RPC-EXT] addEventListener called');
    this.currentListener = listener;
    this.disposeEventListener = this.webview.onDidReceiveMessage(
      (message) => {
        debug('[RPC-EXT] Received message from webview');
        const messageEvent = {
          data: message,
        } as MessageEvent;
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
    debug('[RPC-EXT] removeEventListener called');
    if (this.currentListener === listener && this.disposeEventListener) {
      this.disposeEventListener.dispose();
    }
  }
}

export type WebviewHandleType = Remote<WebviewRemoteHandle>;

// initialize RPC on extension side
export function initRPCExtensionSide(
  preview: Preview,
  webview: vscode.Webview,
  disposables: vscode.Disposable[]
): WebviewHandleType {
  debug('[RPC-EXT] initRPCExtensionSide called');
  const extensionEndpoint = new ExtensionEndpoint(webview, disposables);

  // webview to extension calls
  debug('[RPC-EXT] Creating ExtensionHandle');
  const handle = new ExtensionHandle(preview);
  debug('[RPC-EXT] Exposing ExtensionHandle via comlink');
  comlink.expose(handle, extensionEndpoint);

  // extension to webview calls
  debug('[RPC-EXT] Wrapping WebviewHandle via comlink');
  const WebviewHandle = comlink.wrap<WebviewRemoteHandle>(extensionEndpoint);
  debug('[RPC-EXT] initRPCExtensionSide complete');
  return WebviewHandle;
}

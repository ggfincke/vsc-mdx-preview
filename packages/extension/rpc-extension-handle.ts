// packages/extension/rpc-extension-handle.ts
// RPC handle exposed to webview (called via Comlink)

import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import { Preview } from './preview/preview-manager';
import { fetchLocal, FetchResult } from './module-fetcher/module-fetcher';
import { TrustManager } from './security/TrustManager';
import { error as logError, warn as logWarn, debug } from './logging';

// validate fetch request for security
function validateFetchRequest(request: string): boolean {
  // no null bytes
  if (request.includes('\0')) {
    logWarn('Fetch request contains null byte');
    return false;
  }

  // no URL schemes except npm://
  if (/^[a-z]+:\/\//i.test(request) && !request.startsWith('npm://')) {
    logWarn('Fetch request contains disallowed URL scheme', request);
    return false;
  }

  // reasonable length limit
  if (request.length > 2048) {
    logWarn('Fetch request too long', request.length);
    return false;
  }

  return true;
}

// RPC handle exposed to webview (methods callable via Comlink)
class ExtensionHandle {
  preview: Preview;

  constructor(preview: Preview) {
    debug('[EXT-HANDLE] ExtensionHandle created');
    this.preview = preview;
  }

  // handshake to resolve when webview is ready
  handshake(): void {
    debug('[EXT-HANDLE] handshake() called from webview!');
    this.preview.resolveWebviewHandshakePromise();
    debug('[EXT-HANDLE] resolveWebviewHandshakePromise called');
  }

  // report performance metrics from webview
  reportPerformance(evaluationDuration: number): void {
    debug(`[EXT-HANDLE] reportPerformance: ${evaluationDuration}`);
    // validate input
    if (
      typeof evaluationDuration !== 'number' ||
      !isFinite(evaluationDuration)
    ) {
      logWarn('Invalid evaluation duration', evaluationDuration);
      return;
    }

    this.preview.evaluationDuration = evaluationDuration;
    performance.mark('preview/end');
    performance.measure('preview duration', 'preview/start', 'preview/end');
  }

  // ! fetch module for webview (primary attack surface - validates input & checks trust)
  async fetch(
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined> {
    debug(`[EXT-HANDLE] fetch: request=${request}, isBare=${isBare}`);
    // type validation
    if (typeof request !== 'string') {
      logError('fetch: request must be a string');
      return undefined;
    }
    if (typeof isBare !== 'boolean') {
      logError('fetch: isBare must be a boolean');
      return undefined;
    }
    if (typeof parentId !== 'string') {
      logError('fetch: parentId must be a string');
      return undefined;
    }

    // request validation
    if (!validateFetchRequest(request)) {
      logError('fetch: invalid request', request);
      return undefined;
    }

    // trust check (only allow fetch when scripts enabled)
    const trustState = TrustManager.getInstance().getState();
    if (!trustState.canExecute) {
      logWarn('fetch: blocked - scripts not enabled');
      return undefined;
    }

    return fetchLocal(request, isBare, parentId, this.preview);
  }

  // open VS Code settings (optionally to specific setting)
  openSettings(settingId?: string): void {
    debug(`[EXT-HANDLE] openSettings: ${settingId}`);
    if (settingId && typeof settingId === 'string') {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        settingId
      );
    } else {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'mdx-preview'
      );
    }
  }

  // open workspace trust management
  manageTrust(): void {
    debug('[EXT-HANDLE] manageTrust called');
    vscode.commands.executeCommand('workbench.trust.manage');
  }
}

export default ExtensionHandle;

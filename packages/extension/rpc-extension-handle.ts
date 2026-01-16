// packages/extension/rpc-extension-handle.ts
// RPC handle exposed to webview (called via Comlink)

import { performance } from 'perf_hooks';
import * as path from 'path';
import * as vscode from 'vscode';
import { Preview } from './preview/preview-manager';
import { fetchLocal } from './module-fetcher/module-fetcher';
import { checkFsPath } from './security/checkFsPath';
import { getTrustManager, getErrorReporter } from './services';
import { error as logError, warn as logWarn, debug } from './logging';
import { SecurityError, ErrorContext, ErrorSeverity } from './errors';
import {
  validateString,
  validateBoolean,
  validateNumber,
  validateUrl,
  validateOptionalNumber,
} from './utils/validation';
import { MAX_FETCH_REQUEST_LENGTH } from './constants';
import type { ExtensionRPC, FetchResult } from '@mdx-preview/shared-types';

// allowed URL schemes for openExternal
const ALLOWED_EXTERNAL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

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
  if (request.length > MAX_FETCH_REQUEST_LENGTH) {
    logWarn('Fetch request too long', request.length);
    return false;
  }

  return true;
}

// RPC handle exposed to webview (methods callable via Comlink)
class ExtensionHandle implements ExtensionRPC {
  preview: Preview;

  constructor(preview: Preview) {
    debug('[EXT-HANDLE] ExtensionHandle created');
    this.preview = preview;
  }

  // handshake to resolve when webview is ready
  handshake(): void {
    debug('[EXT-HANDLE] handshake() called from webview!');
    this.preview.completeHandshake();
    debug('[EXT-HANDLE] completeHandshake called');
  }

  // report performance metrics from webview
  reportPerformance(evaluationDuration: number): void {
    debug(`[EXT-HANDLE] reportPerformance: ${evaluationDuration}`);
    const validDuration = validateNumber(evaluationDuration, 'evaluationDuration', {
      context: 'reportPerformance',
      finite: true,
    });
    if (validDuration === undefined) {
      return;
    }

    this.preview.evaluationDuration = validDuration;
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

    // type validation using utilities
    const opts = { context: 'fetch', log: logError };
    const validRequest = validateString(request, 'request', {
      ...opts,
      allowEmpty: true, // allow empty string, validateFetchRequest handles length
    });
    const validIsBare = validateBoolean(isBare, 'isBare', opts);
    const validParentId = validateString(parentId, 'parentId', {
      ...opts,
      allowEmpty: true,
    });

    if (validRequest === undefined || validIsBare === undefined || validParentId === undefined) {
      return undefined;
    }

    // request validation (security checks)
    if (!validateFetchRequest(validRequest)) {
      logError('fetch: invalid request', validRequest);
      return undefined;
    }

    // document-aware trust check (validates workspace trust, scripts, remote env, scheme)
    const docUri = this.preview.doc.uri;
    const trustState = getTrustManager().getStateForDocument(docUri);
    if (!trustState.canExecute) {
      logWarn(`fetch: blocked - ${trustState.reason || 'not in Trusted Mode'}`);
      return undefined;
    }

    return fetchLocal(validRequest, validIsBare, validParentId, this.preview);
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

  // open external URL in default browser
  openExternal(url: string): void {
    debug(`[EXT-HANDLE] openExternal: ${url}`);

    // validate URL w/ allowed schemes
    const parsed = validateUrl(url, 'URL', {
      context: 'openExternal',
      allowedSchemes: ALLOWED_EXTERNAL_SCHEMES,
    });

    if (!parsed) {
      return;
    }

    vscode.env.openExternal(vscode.Uri.parse(url));
  }

  // open document in editor (optionally at specific line/column)
  async openDocument(
    relativePath: string,
    line?: number,
    column?: number
  ): Promise<void> {
    debug(
      `[EXT-HANDLE] openDocument: ${relativePath}${line ? `:${line}` : ''}${column ? `:${column}` : ''}`
    );

    const opts = { context: 'openDocument' };

    // validate path (required)
    const validPath = validateString(relativePath, 'path', opts);
    if (!validPath) {
      return;
    }

    // validate line/column if provided (optional, min 1)
    const validLine = validateOptionalNumber(line, 'line number', { ...opts, min: 1 });
    const validColumn = validateOptionalNumber(column, 'column number', { ...opts, min: 1 });

    // get current document directory from preview
    const entryDir = this.preview.entryFsDirectory;
    if (!entryDir) {
      logWarn('openDocument: no entry directory');
      return;
    }

    // resolve relative path
    const resolvedPath = path.resolve(entryDir, validPath);

    // ! security check - ensure path is within workspace
    if (!checkFsPath(entryDir, resolvedPath)) {
      getErrorReporter().report(
        new SecurityError(
          'Cannot open file outside workspace folder',
          'PATH_TRAVERSAL',
          resolvedPath
        ),
        { context: ErrorContext.Security, severity: ErrorSeverity.Warning }
      );
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(resolvedPath);

      // create selection if line is provided (VS Code uses 0-based indexing)
      const options: vscode.TextDocumentShowOptions = {};
      if (validLine !== undefined) {
        const lineIndex = validLine - 1;
        const colIndex = validColumn !== undefined ? validColumn - 1 : 0;
        const position = new vscode.Position(lineIndex, colIndex);
        options.selection = new vscode.Range(position, position);
      }

      await vscode.window.showTextDocument(doc, options);
    } catch (err) {
      getErrorReporter().reportToUser(
        new Error(`Could not open file: ${relativePath}`),
        ErrorContext.Extension
      );
    }
  }
}

export default ExtensionHandle;

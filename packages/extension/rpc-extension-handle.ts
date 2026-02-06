// packages/extension/rpc-extension-handle.ts
// RPC handle exposed to webview (called via Comlink)

import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import { Preview } from './preview/preview-manager';
import { fetchLocal } from './module-system/fetcher/fetchLocal';
import { getTrustManager, getErrorReporter } from './services';
import { tryRequireTrustedModeForDocument } from './security/validateTrust';
import { createTaggedLogger } from './logging';
import { LogTags } from '@mdx-preview/shared';

const log = createTaggedLogger(LogTags.EXT_HANDLE);
import { ErrorContext } from './errors';
import {
  validateString,
  validateBoolean,
  validateNumber,
  validateUrl,
  validateOptionalNumber,
} from './utils/validation/index';
import {
  validateAndResolveSecurePath,
  reportTrustViolationError,
} from './utils/pathSecurity';
import { MAX_FETCH_REQUEST_LENGTH } from './constants';
import { isValidModuleRequest } from '@mdx-preview/shared';
import type { ExtensionRPC, FetchResult } from '@mdx-preview/shared';

// allowed URL schemes for openExternal
const ALLOWED_EXTERNAL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

// validate fetch request for security
function validateFetchRequest(request: string): boolean {
  // use shared module ID validation (null bytes, URL scheme check)
  if (!isValidModuleRequest(request)) {
    log.warn('Fetch request failed security validation', request);
    return false;
  }

  // reasonable length limit
  if (request.length > MAX_FETCH_REQUEST_LENGTH) {
    log.warn('Fetch request too long', request.length);
    return false;
  }

  return true;
}

// RPC handle exposed to webview (methods callable via Comlink)
class ExtensionHandle implements ExtensionRPC {
  preview: Preview;

  constructor(preview: Preview) {
    log.debug('ExtensionHandle created');
    this.preview = preview;
  }

  // handshake to resolve when webview is ready
  handshake(): void {
    log.debug('handshake() called from webview!');
    this.preview.completeHandshake();
    log.debug('completeHandshake called');
  }

  // report performance metrics from webview
  reportPerformance(evaluationDuration: number): void {
    log.debug(`reportPerformance: ${evaluationDuration}`);
    const validDuration = validateNumber(
      evaluationDuration,
      'evaluationDuration',
      {
        context: 'reportPerformance',
        finite: true,
      }
    );
    if (validDuration === undefined) {
      return;
    }

    this.preview.evaluationDuration = validDuration;
    performance.mark('preview/end');
    performance.measure('preview duration', 'preview/start', 'preview/end');
  }

  // fetch module for webview (primary attack surface - validate input & check trust)
  async fetch(
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined> {
    log.debug(`fetch: request=${request}, isBare=${isBare}`);

    // type validation using utilities
    const opts = { context: 'fetch', log: log.error };
    // allow empty string, validateFetchRequest handles length
    const validRequest = validateString(request, 'request', {
      ...opts,
      allowEmpty: true,
    });
    const validIsBare = validateBoolean(isBare, 'isBare', opts);
    const validParentId = validateString(parentId, 'parentId', {
      ...opts,
      allowEmpty: true,
    });

    if (
      validRequest === undefined ||
      validIsBare === undefined ||
      validParentId === undefined
    ) {
      return undefined;
    }

    // request validation (security checks)
    if (!validateFetchRequest(validRequest)) {
      log.error('fetch: invalid request', validRequest);
      return undefined;
    }

    // guard against disposed preview (panel closed during in-flight RPC)
    if (!this.preview.active) {
      log.debug('fetch: preview is not active');
      return undefined;
    }

    // require Trusted Mode for module fetch
    const docUri = this.preview.doc.uri;
    if (
      !tryRequireTrustedModeForDocument(docUri, 'fetch module', (error) =>
        log.warn(`fetch: blocked - ${error.message}`)
      )
    ) {
      return undefined;
    }

    return fetchLocal(validRequest, validIsBare, validParentId, this.preview);
  }

  // open VS Code settings (optionally to specific setting)
  openSettings(settingId?: string): void {
    log.debug(`openSettings: ${settingId}`);
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
    log.debug('manageTrust called');
    vscode.commands.executeCommand('workbench.trust.manage');
  }

  // open external URL in default browser
  openExternal(url: string): void {
    log.debug(`openExternal: ${url}`);

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
    log.debug(
      `openDocument: ${relativePath}${line ? `:${line}` : ''}${column ? `:${column}` : ''}`
    );

    const opts = { context: 'openDocument' };

    // validate path (required)
    const validPath = validateString(relativePath, 'path', opts);
    if (!validPath) {
      return;
    }

    // workspace trust check via TrustManager (not direct vscode.workspace.isTrusted)
    const trustState = getTrustManager().getState();
    if (!trustState.workspaceTrusted) {
      log.warn('openDocument: blocked - workspace not trusted');
      return;
    }

    // validate line/column if provided (optional, min 1)
    const validLine = validateOptionalNumber(line, 'line number', {
      ...opts,
      min: 1,
    });
    const validColumn = validateOptionalNumber(column, 'column number', {
      ...opts,
      min: 1,
    });

    // validate & resolve path securely (entry dir check + path traversal check)
    const securePathResult = await validateAndResolveSecurePath(
      this.preview,
      validPath,
      'openDocument'
    );
    if (!securePathResult) {
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(
        securePathResult.resolvedPath
      );

      // create selection if line is provided (VS Code uses 0-based indexing)
      const options: vscode.TextDocumentShowOptions = {};
      if (validLine !== undefined) {
        const lineIndex = validLine - 1;
        const colIndex = validColumn !== undefined ? validColumn - 1 : 0;
        const position = new vscode.Position(lineIndex, colIndex);
        options.selection = new vscode.Range(position, position);
      }

      await vscode.window.showTextDocument(doc, options);
    } catch {
      getErrorReporter().reportToUser(
        new Error(`Could not open file: ${relativePath}`),
        ErrorContext.Extension
      );
    }
  }

  // open preview for an MDX file (used for internal link navigation)
  async openPreview(relativePath: string): Promise<void> {
    log.debug(`openPreview: ${relativePath}`);

    const opts = { context: 'openPreview' };

    // validate path (required)
    const validPath = validateString(relativePath, 'path', opts);
    if (!validPath) {
      return;
    }

    // validate & resolve path securely (entry dir check + path traversal check)
    const securePathResult = await validateAndResolveSecurePath(
      this.preview,
      validPath,
      'openPreview'
    );
    if (!securePathResult) {
      return;
    }

    // require Trusted Mode for target file - ensure preview can execute safely
    const targetUri = vscode.Uri.file(securePathResult.resolvedPath);
    if (
      !tryRequireTrustedModeForDocument(targetUri, 'open preview', (error) =>
        reportTrustViolationError(
          securePathResult.resolvedPath,
          error.message,
          'openPreview'
        )
      )
    ) {
      return;
    }

    try {
      // open document in editor (this makes it the active editor)
      const doc = await vscode.workspace.openTextDocument(
        securePathResult.resolvedPath
      );
      await vscode.window.showTextDocument(doc, { preview: false });

      // dynamically import openPreview to avoid circular dependency
      // openPreview() uses the active editor's document
      const { openPreview } = await import('./preview/preview-manager');
      await openPreview();
    } catch {
      getErrorReporter().reportToUser(
        new Error(`Could not open preview: ${relativePath}`),
        ErrorContext.Extension
      );
    }
  }
}

export default ExtensionHandle;

// packages/extension-host/src/platform/rpc/extension-rpc-handler.ts
// RPC handle exposed to webview (called via Comlink)

import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import type {
  ExtensionRPC,
  FetchResult,
  PreviewSourceLineReportResult,
} from '@mdx-preview/contracts';
import { LogTags } from '@mdx-preview/contracts';
import {
  extractErrorMessage,
  getPlantUmlRenderEndpoints,
  isValidModuleRequest,
} from '@mdx-preview/runtime-utils';

import type { Preview } from '../../features/preview/Preview';
import {
  handlePreviewSourceLineReport,
  suppressEditorScrollSync,
} from '../../features/preview/scroll-sync';
import { fetchLocal } from '../../features/module-runtime/fetch/fetchLocal';
import { getErrorReporter, getConfigManager } from '../../app/services';
import {
  tryRequireTrustedModeForDocument,
  tryRequireWorkspaceTrusted,
} from '../../features/security/validateTrust';
import {
  validateAndResolveSecurePath,
  reportTrustViolationError,
} from '../../features/security/pathSecurity';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { createTaggedLogger } from '../../shared/logging/logger';
import { ErrorContext } from '../../shared/errors';
import {
  validateString,
  validateBoolean,
  validateNumber,
  validateUrl,
  validateOptionalNumber,
} from '../../shared/utils/validation';
import { MAX_FETCH_REQUEST_LENGTH } from '../../shared/constants';
import { AsyncLruCache } from '../../shared/utils/cache';

const log = createTaggedLogger(LogTags.EXT_HANDLE);

// allowed URL schemes for openExternal
const ALLOWED_EXTERNAL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];
const PLANTUML_CACHE_MAX_ENTRIES = 64;

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
  private readonly openPreviewCommand: () => Promise<void>;
  private readonly plantUmlCache = new AsyncLruCache<string, string>({
    maxEntries: PLANTUML_CACHE_MAX_ENTRIES,
  });
  private plantUmlServer: string | undefined;

  constructor(preview: Preview, openPreview: () => Promise<void>) {
    log.debug('ExtensionHandle created');
    this.preview = preview;
    this.openPreviewCommand = openPreview;
  }

  // handshake to resolve when webview is ready
  handshake(handshakeId: number): void {
    log.debug(`handshake() called from webview: ${handshakeId}`);
    const accepted = this.preview.completeHandshake(handshakeId);
    log.debug(
      accepted ? 'completeHandshake accepted' : 'completeHandshake ignored'
    );
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
    const target =
      settingId && typeof settingId === 'string' ? settingId : 'mdx-preview';
    vscode.commands.executeCommand('workbench.action.openSettings', target);
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
    const validPath = validateString(relativePath, 'path', opts);
    if (!validPath) {
      return;
    }

    // workspace trust gate (named helper - checks ONLY workspaceTrusted)
    if (
      !tryRequireWorkspaceTrusted('open document', (error) =>
        log.warn(`openDocument: blocked - ${error.message}`)
      )
    ) {
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

    const validPath = validateString(relativePath, 'path', {
      context: 'openPreview',
    });
    if (!validPath) {
      return;
    }

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
        reportTrustViolationError(securePathResult.resolvedPath, error.message)
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

      await this.openPreviewCommand();
    } catch {
      getErrorReporter().reportToUser(
        new Error(`Could not open preview: ${relativePath}`),
        ErrorContext.Extension
      );
    }
  }

  // open the preview's own source document in the editor at the given line
  // (cmd+click on a preview element wires through here)
  async openSourceLine(line: number): Promise<void> {
    const validLine = validateNumber(line, 'line number', {
      context: 'openSourceLine',
      min: 1,
      integer: true,
    });
    if (validLine === undefined) {
      return;
    }

    if (!this.preview.active) {
      return;
    }

    // pre-suppress editor->preview sync: showTextDocument fires
    // onDidChangeTextEditorVisibleRanges which would otherwise bounce back
    suppressEditorScrollSync(this.preview);

    const lineIndex = validLine - 1;
    const position = new vscode.Position(lineIndex, 0);
    const selection = new vscode.Range(position, position);

    try {
      await vscode.window.showTextDocument(this.preview.doc, {
        selection,
        preserveFocus: false,
      });
    } catch (error) {
      log.warn('openSourceLine: failed to show document', error);
    }

    // re-arm suppression after the await: if showTextDocument latency outran
    // the 120ms window the visible-range event has yet to fire, & we still
    // want the resulting editor->preview bounce-back suppressed
    suppressEditorScrollSync(this.preview);
  }

  async reportPreviewSourceLine(
    line: number
  ): Promise<PreviewSourceLineReportResult> {
    const validLine = validateNumber(line, 'line number', {
      context: 'reportPreviewSourceLine',
      min: 1,
      integer: true,
    });
    if (validLine === undefined) {
      return 'ignored';
    }

    return handlePreviewSourceLineReport(this.preview, validLine);
  }

  // proxy PlantUML rendering via extension host (avoids CORS in webview)
  async renderPlantUml(code: string): Promise<string | undefined> {
    const opts = { context: 'renderPlantUml' };

    const validCode = validateString(code, 'code', opts);
    if (!validCode) {
      return undefined;
    }

    // workspace trust gate: rendering sends diagram source to a remote server
    if (
      !tryRequireWorkspaceTrusted('render PlantUML', (error) =>
        log.warn(`renderPlantUml: blocked - ${error.message}`)
      )
    ) {
      throw new Error(
        'PlantUML rendering is disabled in untrusted workspaces because diagram source is sent to a remote render server. Trust this workspace to enable it.'
      );
    }

    const serverUrl = getConfigManager().get(
      SETTINGS.PLANTUML_SERVER,
      this.preview.doc.uri
    );
    if (
      this.plantUmlServer !== undefined &&
      this.plantUmlServer !== serverUrl
    ) {
      this.plantUmlCache.clear();
    }
    this.plantUmlServer = serverUrl;

    const cacheKey = JSON.stringify([serverUrl, validCode]);
    return this.plantUmlCache.getOrCreate(cacheKey, () =>
      this.fetchPlantUml(validCode, serverUrl)
    );
  }

  private async fetchPlantUml(
    validCode: string,
    serverUrl: string
  ): Promise<string | undefined> {
    const endpoints = getPlantUmlRenderEndpoints(serverUrl);
    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            Accept: 'image/svg+xml,text/plain,*/*',
          },
          body: validCode,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${endpoint}`);
        }

        const svg = await response.text();
        if (!svg.includes('<svg')) {
          throw new Error(
            `Server response from ${endpoint} did not contain SVG`
          );
        }

        return svg;
      } catch (error) {
        lastError = error;
        log.debug('PlantUML endpoint failed', {
          endpoint,
          error: extractErrorMessage(error),
        });
      }
    }

    log.error('All PlantUML endpoints failed', extractErrorMessage(lastError));
    return undefined;
  }
}

export default ExtensionHandle;

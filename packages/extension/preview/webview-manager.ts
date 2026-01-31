// packages/extension/preview/webview-manager.ts
// webview panel management & HTML generation for MDX preview

import * as path from 'path';
import * as vscode from 'vscode';

import {
  Preview,
  StyleConfiguration,
  type WebviewAppUris,
} from './preview-manager';
import { getCSP, generateNonce } from '../security/CSP';
import { initRPCExtensionSide } from '../rpc-extension';
import { getPreviewManager, getTrustManager } from '../services';
import { debug } from '../logging';
import { WebviewError } from '../errors';
import { CSP_DEBUG_PREVIEW_LENGTH } from '../constants';
import { formatTrustStateForDebug, LogTags } from '@mdx-preview/shared';

const VIEW_TYPE = 'mdx.preview';
const MDX_PREVIEW_FOCUS_CONTEXT_KEY = 'mdxPreviewFocus';

// NOTE: panel, panelDoc, disposables, & URI state have been moved to PreviewManager
// for better testability & lifecycle management

// G.3 optimization: Module-level promise for background resource loading
let webviewResourcesPromise: Promise<void> | null = null;
let webviewResourcesError: Error | null = null;

// initialize webview HTML resources in the background (non-blocking)
// call this during activation without awaiting
// G.3 optimization: allows extension activation to proceed without blocking on file I/O
export function initWebviewAppHTMLResourcesAsync(
  context: vscode.ExtensionContext
): void {
  debug(
    `[${LogTags.WEBVIEW_MGR}] Starting background webview resource initialization`
  );
  webviewResourcesPromise = initWebviewAppHTMLResources(context)
    .then(() => {
      debug(
        `[${LogTags.WEBVIEW_MGR}] Background resource initialization complete`
      );
    })
    .catch((err) => {
      webviewResourcesError = err;
      debug(
        `[${LogTags.WEBVIEW_MGR}] Background resource initialization failed:`,
        err
      );
    });
}

// ensure webview resources are ready before creating a panel
// awaits the background initialization if it hasn't completed yet
// G.3 optimization: only blocks when actually creating a panel, not during activation
export async function ensureWebviewResourcesReady(): Promise<void> {
  if (webviewResourcesPromise) {
    await webviewResourcesPromise;
  }
  if (webviewResourcesError) {
    throw webviewResourcesError;
  }
}

export async function initWebviewAppHTMLResources(
  context: vscode.ExtensionContext
): Promise<void> {
  debug(`[${LogTags.WEBVIEW_MGR}] initWebviewAppHTMLResources called`);
  const manager = getPreviewManager();
  manager.setExtensionUri(context.extensionUri);

  // Vite manifest format - use Uri.joinPath & workspace.fs for extension resources
  const manifestUri = vscode.Uri.joinPath(
    context.extensionUri,
    'build',
    'webview-app',
    '.vite',
    'manifest.json'
  );

  debug(
    `[${LogTags.WEBVIEW_MGR}] Reading manifest from: ${manifestUri.fsPath}`
  );
  // use workspace.fs.readFile for extension resources (works in remote/virtual scenarios)
  const manifestBytes = await vscode.workspace.fs.readFile(manifestUri);
  const manifestContent = new TextDecoder().decode(manifestBytes);
  const manifest = JSON.parse(manifestContent);

  // the entry is "index.html"
  const entry = manifest['index.html'];
  if (!entry) {
    throw new WebviewError(
      'Could not find index.html entry in Vite manifest',
      'E600',
      'init'
    );
  }

  const webviewAppBaseUri = vscode.Uri.joinPath(
    context.extensionUri,
    'build',
    'webview-app'
  );

  const webviewAppUris: WebviewAppUris = {
    mainScript: vscode.Uri.joinPath(webviewAppBaseUri, entry.file),
    mainStyle: entry.css?.[0]
      ? vscode.Uri.joinPath(webviewAppBaseUri, entry.css[0])
      : undefined,
  };
  manager.setWebviewAppUris(webviewAppUris);
  debug(
    `[${LogTags.WEBVIEW_MGR}] Loaded mainScript: ${webviewAppUris.mainScript.fsPath}`
  );
  debug(
    `[${LogTags.WEBVIEW_MGR}] Loaded mainStyle: ${webviewAppUris.mainStyle?.fsPath ?? 'none'}`
  );
}

function getWebviewAppHTML(
  webview: vscode.Webview,
  baseHref: string,
  nonce: string,
  contentSecurityPolicy: string,
  styleConfiguration: StyleConfiguration
): string | undefined {
  const webviewAppUris = getPreviewManager().getWebviewAppUris();
  if (!webviewAppUris) {
    debug(
      `[${LogTags.WEBVIEW_MGR}] getWebviewAppHTML: webviewAppUris is undefined!`
    );
    return undefined;
  }

  const { useVscodeMarkdownStyles, useWhiteBackground } = styleConfiguration;

  // convert extension URIs to webview URIs
  const scriptUri = webview.asWebviewUri(webviewAppUris.mainScript);
  const styleUri = webviewAppUris.mainStyle
    ? webview.asWebviewUri(webviewAppUris.mainStyle)
    : undefined;

  debug(
    `[${LogTags.WEBVIEW_MGR}] getWebviewAppHTML: scriptUri=${scriptUri.toString()}`
  );

  let styleNodeHTML = '';
  const overrideBodyStyles = useWhiteBackground
    ? `body { color: black; background: white; }`
    : '';

  const overrideDefaultStyles = !useVscodeMarkdownStyles
    ? `code { color: inherit; } blockquote { background: inherit; }`
    : '';

  if (overrideBodyStyles || overrideDefaultStyles) {
    styleNodeHTML = `<style type="text/css">${overrideBodyStyles}${overrideDefaultStyles}</style>`;
  }

  const styleLink = styleUri
    ? `<link rel="stylesheet" type="text/css" href="${styleUri}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MDX Preview</title>
    ${styleLink}
    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
    <base href="${baseHref}">
    ${styleNodeHTML}
</head>
<body>
    <div id="root"></div>
    <script type="module" crossorigin nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function dispose(): void {
  debug(`[${LogTags.WEBVIEW_MGR}] dispose called`);
  getPreviewManager().clearPanel();
}

function setPanelHTMLFromPreview(preview: Preview): void {
  debug(`[${LogTags.WEBVIEW_MGR}] setPanelHTMLFromPreview called`);
  const panel = getPreviewManager().getPanel();
  if (!panel) {
    debug(`[${LogTags.WEBVIEW_MGR}] setPanelHTMLFromPreview: no panel!`);
    return;
  }

  const { doc, styleConfiguration } = preview;
  const previewBaseHref = panel.webview.asWebviewUri(doc.uri).toString(true);

  // get current trust state (document-specific, includes remote/scheme checks)
  const trustState = getTrustManager().getStateForDocument(doc.uri);
  debug(formatTrustStateForDebug(LogTags.WEBVIEW_MGR, trustState));

  // generate nonce for script tags
  const nonce = generateNonce();

  // get CSP based on trust state
  const csp = getCSP(
    panel.webview,
    nonce,
    trustState,
    preview.securityConfiguration.securityPolicy
  );
  debug(
    `[${LogTags.WEBVIEW_MGR}] CSP: ${csp.substring(0, CSP_DEBUG_PREVIEW_LENGTH)}...`
  );

  const webviewAppHTML = getWebviewAppHTML(
    panel.webview,
    previewBaseHref,
    nonce,
    csp,
    styleConfiguration
  );

  if (webviewAppHTML) {
    debug(
      `[${LogTags.WEBVIEW_MGR}] Setting webview HTML (${webviewAppHTML.length} chars)`
    );
    panel.webview.html = webviewAppHTML;
  } else {
    debug(`[${LogTags.WEBVIEW_MGR}] webviewAppHTML is undefined!`);
  }
}

export async function createOrShowPanel(
  preview: Preview
): Promise<vscode.WebviewPanel> {
  debug(`[${LogTags.WEBVIEW_MGR}] createOrShowPanel called`);

  // G.3 optimization: Ensure webview resources are ready before proceeding
  // This only blocks if background init hasn't completed yet (rare case)
  await ensureWebviewResourcesReady();

  const manager = getPreviewManager();

  // use ViewColumn.Beside to open preview next to the active editor
  // this is the modern VS Code approach that handles edge cases better
  const previewColumn = vscode.ViewColumn.Beside;
  const previewTitle = `Preview ${path.basename(preview.doc.fileName)}`;

  let panel = manager.getPanel();
  const panelDoc = manager.getPanelDoc();
  const disposables = manager.getPanelDisposables();

  if (!panel) {
    debug(`[${LogTags.WEBVIEW_MGR}] Creating new webview panel`);
    // set up local resource roots for security
    const localResourceRoots: vscode.Uri[] = [];
    const extensionUri = manager.getExtensionUri();
    if (extensionUri) {
      localResourceRoots.push(
        vscode.Uri.joinPath(extensionUri, 'build', 'webview-app')
      );
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      workspaceFolders.forEach((folder) => localResourceRoots.push(folder.uri));
    }

    panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      previewTitle,
      previewColumn,
      {
        enableScripts: true,
        // ! disable command URIs - preview content should not execute VS Code commands
        enableCommandUris: false,
        retainContextWhenHidden: true,
        localResourceRoots,
      }
    );
    manager.setPanel(panel);
    manager.setPanelDoc(preview.doc);
    debug(`[${LogTags.WEBVIEW_MGR}] Panel created, setting HTML`);
    setPanelHTMLFromPreview(preview);

    vscode.commands.executeCommand(
      'setContext',
      MDX_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    );

    panel.onDidDispose(
      () => {
        debug(`[${LogTags.WEBVIEW_MGR}] Panel disposed`);
        preview.active = false;
        // reset rendered version to force re-render on reopen
        preview.resetRenderedVersion();
        dispose();
      },
      null,
      disposables
    );

    panel.onDidChangeViewState(
      ({ webviewPanel }) => {
        vscode.commands.executeCommand(
          'setContext',
          MDX_PREVIEW_FOCUS_CONTEXT_KEY,
          webviewPanel.active
        );
      },
      null,
      disposables
    );

    debug(`[${LogTags.WEBVIEW_MGR}] Initializing handshake promise`);
    preview.initWebviewHandshakePromise();
    preview.webview = panel.webview;
    debug(`[${LogTags.WEBVIEW_MGR}] Initializing RPC extension side`);
    const webviewHandle = initRPCExtensionSide(
      preview,
      panel.webview,
      disposables
    );
    preview.setWebviewHandle(webviewHandle);
    debug(`[${LogTags.WEBVIEW_MGR}] RPC initialized`);
  } else {
    debug(
      `[${LogTags.WEBVIEW_MGR}] Panel exists, panelDoc=${panelDoc?.uri.fsPath}, preview.doc=${preview.doc.uri.fsPath}`
    );
    if (panelDoc !== preview.doc) {
      debug(`[${LogTags.WEBVIEW_MGR}] Different doc, reinitializing handshake`);
      // re-initialize handshake since we're resetting the webview HTML
      preview.initWebviewHandshakePromise();
      panel.title = previewTitle;
      setPanelHTMLFromPreview(preview);
      manager.setPanelDoc(preview.doc);
    } else {
      debug(`[${LogTags.WEBVIEW_MGR}] Same doc, just revealing panel`);
      // cancel any stale handshake timeout from previous operations
      // this prevents timeout errors when the preview was already rendered
      preview.cancelHandshakeTimeout();
    }
    panel.reveal(previewColumn);

    vscode.commands.executeCommand(
      'setContext',
      MDX_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    );
  }

  preview.active = true;
  debug(`[${LogTags.WEBVIEW_MGR}] createOrShowPanel complete`);
  return panel;
}

export function refreshPanel(preview: Preview): void {
  debug(`[${LogTags.WEBVIEW_MGR}] refreshPanel called`);
  const panel = getPreviewManager().getPanel();
  if (!panel) {
    debug(`[${LogTags.WEBVIEW_MGR}] refreshPanel: no panel`);
    return;
  }
  // re-initialize handshake since we're resetting the webview HTML
  debug(`[${LogTags.WEBVIEW_MGR}] Reinitializing handshake for refresh`);
  preview.initWebviewHandshakePromise();
  // reveal in current column & preserve focus
  panel.reveal(undefined, true);
  panel.webview.html = '';
  debug(`[${LogTags.WEBVIEW_MGR}] Setting new HTML`);
  setPanelHTMLFromPreview(preview);
  debug(`[${LogTags.WEBVIEW_MGR}] refreshPanel complete`);
}

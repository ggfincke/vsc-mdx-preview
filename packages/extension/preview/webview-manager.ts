// packages/extension/preview/webview-manager.ts
// webview panel management & HTML generation for MDX preview

import * as path from 'path';
import * as vscode from 'vscode';

import { Preview, StyleConfiguration } from './preview-manager';
import { getCSP, generateNonce } from '../security/CSP';
import { TrustManager } from '../security/TrustManager';
import { initRPCExtensionSide } from '../rpc-extension';
import { debug } from '../logging';

const VIEW_TYPE = 'mdx.preview';
const MDX_PREVIEW_FOCUS_CONTEXT_KEY = 'mdxPreviewFocus';

let panel: vscode.WebviewPanel | undefined;
let panelDoc: vscode.TextDocument | undefined;
const disposables: vscode.Disposable[] = [];

interface WebviewAppUris {
  mainScript: vscode.Uri;
  mainStyle: vscode.Uri | undefined;
}

let webviewAppUris: WebviewAppUris | undefined;
let extensionUriCache: vscode.Uri | undefined;

export async function initWebviewAppHTMLResources(
  context: vscode.ExtensionContext
): Promise<void> {
  debug('[WEBVIEW-MGR] initWebviewAppHTMLResources called');
  extensionUriCache = context.extensionUri;

  // Vite manifest format - use Uri.joinPath and workspace.fs for extension resources
  const manifestUri = vscode.Uri.joinPath(
    context.extensionUri,
    'build',
    'webview-app',
    '.vite',
    'manifest.json'
  );

  debug(`[WEBVIEW-MGR] Reading manifest from: ${manifestUri.fsPath}`);
  // Use workspace.fs.readFile for extension resources (works in remote/virtual scenarios)
  const manifestBytes = await vscode.workspace.fs.readFile(manifestUri);
  const manifestContent = new TextDecoder().decode(manifestBytes);
  const manifest = JSON.parse(manifestContent);

  // The entry is "index.html"
  const entry = manifest['index.html'];
  if (!entry) {
    throw new Error('Could not find index.html entry in Vite manifest');
  }

  const webviewAppBaseUri = vscode.Uri.joinPath(
    context.extensionUri,
    'build',
    'webview-app'
  );

  webviewAppUris = {
    mainScript: vscode.Uri.joinPath(webviewAppBaseUri, entry.file),
    mainStyle: entry.css?.[0]
      ? vscode.Uri.joinPath(webviewAppBaseUri, entry.css[0])
      : undefined,
  };
  debug(`[WEBVIEW-MGR] Loaded mainScript: ${webviewAppUris.mainScript.fsPath}`);
  debug(
    `[WEBVIEW-MGR] Loaded mainStyle: ${webviewAppUris.mainStyle?.fsPath ?? 'none'}`
  );
}

function getWebviewAppHTML(
  webview: vscode.Webview,
  baseHref: string,
  nonce: string,
  contentSecurityPolicy: string,
  styleConfiguration: StyleConfiguration
): string | undefined {
  if (!webviewAppUris) {
    debug('[WEBVIEW-MGR] getWebviewAppHTML: webviewAppUris is undefined!');
    return undefined;
  }

  const { useVscodeMarkdownStyles, useWhiteBackground } = styleConfiguration;

  // Convert extension URIs to webview URIs
  const scriptUri = webview.asWebviewUri(webviewAppUris.mainScript);
  const styleUri = webviewAppUris.mainStyle
    ? webview.asWebviewUri(webviewAppUris.mainStyle)
    : undefined;

  debug(`[WEBVIEW-MGR] getWebviewAppHTML: scriptUri=${scriptUri.toString()}`);

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
  debug('[WEBVIEW-MGR] dispose called');
  panel?.dispose();
  while (disposables.length) {
    const disposable = disposables.pop();
    if (disposable) {
      disposable.dispose();
    }
  }
  panel = undefined;
}

function setPanelHTMLFromPreview(preview: Preview): void {
  debug('[WEBVIEW-MGR] setPanelHTMLFromPreview called');
  if (!panel) {
    debug('[WEBVIEW-MGR] setPanelHTMLFromPreview: no panel!');
    return;
  }

  const { doc, styleConfiguration } = preview;
  const previewBaseHref = panel.webview.asWebviewUri(doc.uri).toString(true);

  // Get current trust state (document-specific, includes remote/scheme checks)
  const trustState = TrustManager.getInstance().getStateForDocument(doc.uri);
  debug(
    `[WEBVIEW-MGR] Trust state: canExecute=${trustState.canExecute}, workspaceTrusted=${trustState.workspaceTrusted}, scriptsEnabled=${trustState.scriptsEnabled}`
  );

  // Generate nonce for script tags
  const nonce = generateNonce();

  // Get CSP based on trust state
  const csp = getCSP(
    panel.webview,
    nonce,
    trustState,
    preview.securityConfiguration.securityPolicy
  );
  debug(`[WEBVIEW-MGR] CSP: ${csp.substring(0, 100)}...`);

  const webviewAppHTML = getWebviewAppHTML(
    panel.webview,
    previewBaseHref,
    nonce,
    csp,
    styleConfiguration
  );

  if (webviewAppHTML) {
    debug(
      `[WEBVIEW-MGR] Setting webview HTML (${webviewAppHTML.length} chars)`
    );
    panel.webview.html = webviewAppHTML;
  } else {
    debug('[WEBVIEW-MGR] webviewAppHTML is undefined!');
  }
}

export function createOrShowPanel(preview: Preview): vscode.WebviewPanel {
  debug('[WEBVIEW-MGR] createOrShowPanel called');
  // Use ViewColumn.Beside to open preview next to the active editor
  // This is the modern VS Code approach that handles edge cases better
  const previewColumn = vscode.ViewColumn.Beside;
  const previewTitle = `Preview ${path.basename(preview.doc.fileName)}`;

  if (!panel) {
    debug('[WEBVIEW-MGR] Creating new webview panel');
    // Set up local resource roots for security
    const localResourceRoots: vscode.Uri[] = [];
    if (extensionUriCache) {
      localResourceRoots.push(
        vscode.Uri.joinPath(extensionUriCache, 'build', 'webview-app')
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
        // SECURITY: Disable command URIs - preview content should not execute VS Code commands
        enableCommandUris: false,
        retainContextWhenHidden: true,
        localResourceRoots,
      }
    );
    panelDoc = preview.doc;
    debug('[WEBVIEW-MGR] Panel created, setting HTML');
    setPanelHTMLFromPreview(preview);

    vscode.commands.executeCommand(
      'setContext',
      MDX_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    );

    panel.onDidDispose(
      () => {
        debug('[WEBVIEW-MGR] Panel disposed');
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

    debug('[WEBVIEW-MGR] Initializing handshake promise');
    preview.initWebviewHandshakePromise();
    preview.webview = panel.webview;
    debug('[WEBVIEW-MGR] Initializing RPC extension side');
    preview.webviewHandle = initRPCExtensionSide(
      preview,
      panel.webview,
      disposables
    );
    debug('[WEBVIEW-MGR] RPC initialized');
  } else {
    debug(
      `[WEBVIEW-MGR] Panel exists, panelDoc=${panelDoc?.uri.fsPath}, preview.doc=${preview.doc.uri.fsPath}`
    );
    if (panelDoc !== preview.doc) {
      debug('[WEBVIEW-MGR] Different doc, reinitializing handshake');
      // Re-initialize handshake since we're resetting the webview HTML
      preview.initWebviewHandshakePromise();
      panel.title = previewTitle;
      setPanelHTMLFromPreview(preview);
      panelDoc = preview.doc;
    } else {
      debug('[WEBVIEW-MGR] Same doc, just revealing panel');
    }
    panel.reveal(previewColumn);

    vscode.commands.executeCommand(
      'setContext',
      MDX_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    );
  }

  preview.active = true;
  debug('[WEBVIEW-MGR] createOrShowPanel complete');
  return panel;
}

export function refreshPanel(preview: Preview): void {
  debug('[WEBVIEW-MGR] refreshPanel called');
  if (!panel) {
    debug('[WEBVIEW-MGR] refreshPanel: no panel');
    return;
  }
  // Re-initialize handshake since we're resetting the webview HTML
  debug('[WEBVIEW-MGR] Reinitializing handshake for refresh');
  preview.initWebviewHandshakePromise();
  // reveal in current column, and preserve focus
  panel.reveal(undefined, true);
  panel.webview.html = '';
  debug('[WEBVIEW-MGR] Setting new HTML');
  setPanelHTMLFromPreview(preview);
  debug('[WEBVIEW-MGR] refreshPanel complete');
}

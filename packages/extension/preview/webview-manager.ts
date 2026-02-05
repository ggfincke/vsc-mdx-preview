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
import { createTaggedLogger } from '../logging';
import { WebviewError } from '../errors';
import {
  CSP_DEBUG_PREVIEW_LENGTH,
  VITE_MANIFEST_DIR,
  VITE_MANIFEST_FILE,
  WEBVIEW_BUILD_DIR,
} from '../constants';
import { formatTrustStateForDebug, LogTags } from '@mdx-preview/shared';

// module-level tagged logger
const log = createTaggedLogger(LogTags.WEBVIEW_MGR);

const VIEW_TYPE = 'mdx.preview';
const MDX_PREVIEW_FOCUS_CONTEXT_KEY = 'mdxPreviewFocus';

// panel, panelDoc, disposables, & URI state moved to PreviewManager for testability

// module-level promise for background resource loading
let webviewResourcesPromise: Promise<void> | null = null;
let webviewResourcesError: Error | null = null;

// initialize webview HTML resources in background (call during activation w/out awaiting)
export function initWebviewAppHTMLResourcesAsync(
  context: vscode.ExtensionContext
): void {
  log.debug(
    'Starting background webview resource initialization'
  );
  webviewResourcesPromise = initWebviewAppHTMLResources(context)
    .then(() => {
      log.debug(
        'Background resource initialization complete'
      );
    })
    .catch((err) => {
      webviewResourcesError = err;
      log.debug(
        'Background resource initialization failed:',
        err
      );
    });
}

// ensure webview resources are ready (only blocks when creating panel)
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
  log.debug('initWebviewAppHTMLResources called');
  const manager = getPreviewManager();
  manager.setExtensionUri(context.extensionUri);

  // vite manifest format - use Uri.joinPath & workspace.fs for extension resources
  const manifestUri = vscode.Uri.joinPath(
    context.extensionUri,
    ...WEBVIEW_BUILD_DIR.split('/'),
    VITE_MANIFEST_DIR,
    VITE_MANIFEST_FILE
  );

  log.debug(
    `Reading manifest from: ${manifestUri.fsPath}`
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
    ...WEBVIEW_BUILD_DIR.split('/')
  );

  const webviewAppUris: WebviewAppUris = {
    mainScript: vscode.Uri.joinPath(webviewAppBaseUri, entry.file),
    mainStyle: entry.css?.[0]
      ? vscode.Uri.joinPath(webviewAppBaseUri, entry.css[0])
      : undefined,
  };
  manager.setWebviewAppUris(webviewAppUris);
  log.debug(
    `Loaded mainScript: ${webviewAppUris.mainScript.fsPath}`
  );
  log.debug(
    `Loaded mainStyle: ${webviewAppUris.mainStyle?.fsPath ?? 'none'}`
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
    log.debug(
      'getWebviewAppHTML: webviewAppUris is undefined!'
    );
    return undefined;
  }

  const { useVscodeMarkdownStyles, useWhiteBackground } = styleConfiguration;

  // convert extension URIs to webview URIs
  const scriptUri = webview.asWebviewUri(webviewAppUris.mainScript);
  const styleUri = webviewAppUris.mainStyle
    ? webview.asWebviewUri(webviewAppUris.mainStyle)
    : undefined;

  log.debug(
    `getWebviewAppHTML: scriptUri=${scriptUri.toString()}`
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
  log.debug('dispose called');
  getPreviewManager().clearPanel();
}

function setPanelHTMLFromPreview(preview: Preview): void {
  log.debug('setPanelHTMLFromPreview called');
  const panel = getPreviewManager().getPanel();
  if (!panel) {
    log.debug('setPanelHTMLFromPreview: no panel!');
    return;
  }

  const { doc, styleConfiguration } = preview;
  const previewBaseHref = panel.webview.asWebviewUri(doc.uri).toString(true);

  // get current trust state (document-specific, includes remote/scheme checks)
  const trustState = getTrustManager().getStateForDocument(doc.uri);
  log.debug(formatTrustStateForDebug(trustState));

  // generate nonce for script tags
  const nonce = generateNonce();

  // get CSP based on trust state
  const csp = getCSP(
    panel.webview,
    nonce,
    trustState,
    preview.securityConfiguration.securityPolicy
  );
  log.debug(
    `CSP: ${csp.substring(0, CSP_DEBUG_PREVIEW_LENGTH)}...`
  );

  const webviewAppHTML = getWebviewAppHTML(
    panel.webview,
    previewBaseHref,
    nonce,
    csp,
    styleConfiguration
  );

  if (webviewAppHTML) {
    log.debug(
      `Setting webview HTML (${webviewAppHTML.length} chars)`
    );
    panel.webview.html = webviewAppHTML;
  } else {
    log.debug('webviewAppHTML is undefined!');
  }
}

export async function createOrShowPanel(
  preview: Preview
): Promise<vscode.WebviewPanel> {
  log.debug('createOrShowPanel called');

  // ensure webview resources are ready (only blocks if background init incomplete)
  await ensureWebviewResourcesReady();

  const manager = getPreviewManager();

  // use ViewColumn.Beside to open preview next to the active editor
  const previewColumn = vscode.ViewColumn.Beside;
  const previewTitle = `Preview ${path.basename(preview.doc.fileName)}`;

  let panel = manager.getPanel();
  const panelDoc = manager.getPanelDoc();
  const disposables = manager.getPanelDisposables();

  if (!panel) {
    log.debug('Creating new webview panel');
    // set up local resource roots for security
    const localResourceRoots: vscode.Uri[] = [];
    const extensionUri = manager.getExtensionUri();
    if (extensionUri) {
      localResourceRoots.push(
        vscode.Uri.joinPath(extensionUri, ...WEBVIEW_BUILD_DIR.split('/'))
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
    log.debug('Panel created, setting HTML');
    setPanelHTMLFromPreview(preview);

    vscode.commands.executeCommand(
      'setContext',
      MDX_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    );

    panel.onDidDispose(
      () => {
        log.debug('Panel disposed');
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

    log.debug('Initializing handshake promise');
    preview.initWebviewHandshakePromise();
    preview.webview = panel.webview;
    log.debug('Initializing RPC extension side');
    const webviewHandle = initRPCExtensionSide(
      preview,
      panel.webview,
      disposables
    );
    preview.setWebviewHandle(webviewHandle);
    log.debug('RPC initialized');
  } else {
    log.debug(
      `Panel exists, panelDoc=${panelDoc?.uri.fsPath}, preview.doc=${preview.doc.uri.fsPath}`
    );
    if (panelDoc !== preview.doc) {
      log.debug('Different doc, reinitializing handshake');
      // reinitialize handshake since we're resetting the webview HTML
      preview.initWebviewHandshakePromise();
      panel.title = previewTitle;
      setPanelHTMLFromPreview(preview);
      manager.setPanelDoc(preview.doc);
    } else {
      log.debug('Same doc, just revealing panel');
      // cancel stale handshake timeout to prevent errors on reuse
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
  log.debug('createOrShowPanel complete');
  return panel;
}

export function refreshPanel(preview: Preview): void {
  log.debug('refreshPanel called');
  const panel = getPreviewManager().getPanel();
  if (!panel) {
    log.debug('refreshPanel: no panel');
    return;
  }
  // reinitialize handshake since we're resetting the webview HTML
  log.debug('Reinitializing handshake for refresh');
  preview.initWebviewHandshakePromise();
  // reveal in current column & preserve focus
  panel.reveal(undefined, true);
  panel.webview.html = '';
  log.debug('Setting new HTML');
  setPanelHTMLFromPreview(preview);
  log.debug('refreshPanel complete');
}

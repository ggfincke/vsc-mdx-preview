// packages/extension-host/src/features/preview/webview-html.ts
// webview HTML generation w/ CSP, style overrides, & Tailwind browser runtime

import * as vscode from 'vscode';
import { Preview, StyleConfiguration } from './preview-manager';
import { getCSP, generateNonce } from '../security/CSP';
import { getPreviewManager, getTrustManager } from '../../app/services';
import { createTaggedLogger } from '../../shared/logging/logger';
import { CSP_DEBUG_PREVIEW_LENGTH } from '../../shared/constants';
import { LogTags, formatTrustStateForDebug } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.WEBVIEW_MGR);

export function getWebviewAppHTML(
  webview: vscode.Webview,
  baseHref: string,
  nonce: string,
  contentSecurityPolicy: string,
  styleConfiguration: StyleConfiguration,
  tailwindBrowserRuntimeEnabled: boolean
): string | undefined {
  const webviewAppUris = getPreviewManager().getWebviewAppUris();
  if (!webviewAppUris) {
    log.debug('getWebviewAppHTML: webviewAppUris is undefined!');
    return undefined;
  }

  const { useVscodeMarkdownStyles, useWhiteBackground } = styleConfiguration;

  // convert extension URIs to webview URIs
  const scriptUri = webview.asWebviewUri(webviewAppUris.mainScript);
  const styleUri = webviewAppUris.mainStyle
    ? webview.asWebviewUri(webviewAppUris.mainStyle)
    : undefined;
  const tailwindBrowserScriptUri = webviewAppUris.tailwindBrowserScript
    ? webview.asWebviewUri(webviewAppUris.tailwindBrowserScript)
    : undefined;

  log.debug(`getWebviewAppHTML: scriptUri=${scriptUri.toString()}`);

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
  const tailwindScriptTag =
    tailwindBrowserRuntimeEnabled && tailwindBrowserScriptUri
      ? `<script nonce="${nonce}" src="${tailwindBrowserScriptUri}"></script>`
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
    ${tailwindScriptTag}
    <script type="module" crossorigin nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export function setPanelHTMLFromPreview(preview: Preview): void {
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
  log.debug(`CSP: ${csp.substring(0, CSP_DEBUG_PREVIEW_LENGTH)}...`);

  const webviewAppHTML = getWebviewAppHTML(
    panel.webview,
    previewBaseHref,
    nonce,
    csp,
    styleConfiguration,
    preview.isTailwindBrowserRuntimeEnabled()
  );

  if (webviewAppHTML) {
    log.debug(`Setting webview HTML (${webviewAppHTML.length} chars)`);
    panel.webview.html = webviewAppHTML;
  } else {
    log.debug('webviewAppHTML is undefined!');
  }
}

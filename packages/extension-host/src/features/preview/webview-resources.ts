// packages/extension-host/src/features/preview/webview-resources.ts
// webview resource initialization & Vite manifest loading

import * as vscode from 'vscode';
import { getPreviewManager, type WebviewAppUris } from './preview-manager';
import { createTaggedLogger } from '../../shared/logging/logger';
import { WebviewError } from '../../shared/errors';
import {
  VITE_MANIFEST_DIR,
  VITE_MANIFEST_FILE,
  WEBVIEW_BUILD_DIR,
} from '../../shared/constants';
import { LogTags } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.WEBVIEW_MGR);

const TAILWIND_BROWSER_RUNTIME_PATH = 'vendor/tailwind-browser.min.js';

// module-level promise for background resource loading
let webviewResourcesPromise: Promise<void> | null = null;
let webviewResourcesError: Error | null = null;

// initialize webview HTML resources in background (call during activation w/out awaiting)
export function initWebviewAppHTMLResourcesAsync(
  context: vscode.ExtensionContext
): void {
  log.debug('Starting background webview resource initialization');
  webviewResourcesPromise = initWebviewAppHTMLResources(context)
    .then(() => {
      log.debug('Background resource initialization complete');
    })
    .catch((err) => {
      webviewResourcesError = err;
      log.debug('Background resource initialization failed:', err);
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

  log.debug(`Reading manifest from: ${manifestUri.fsPath}`);
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
  const tailwindBrowserUri = vscode.Uri.joinPath(
    webviewAppBaseUri,
    ...TAILWIND_BROWSER_RUNTIME_PATH.split('/')
  );

  try {
    await vscode.workspace.fs.stat(tailwindBrowserUri);
  } catch {
    throw new WebviewError(
      `Could not find Tailwind browser runtime at ${tailwindBrowserUri.fsPath}`,
      'E600',
      'init'
    );
  }

  const webviewAppUris: WebviewAppUris = {
    mainScript: vscode.Uri.joinPath(webviewAppBaseUri, entry.file),
    mainStyle: entry.css?.[0]
      ? vscode.Uri.joinPath(webviewAppBaseUri, entry.css[0])
      : undefined,
    tailwindBrowserScript: tailwindBrowserUri,
  };
  manager.setWebviewAppUris(webviewAppUris);
  log.debug(`Loaded mainScript: ${webviewAppUris.mainScript.fsPath}`);
  log.debug(`Loaded mainStyle: ${webviewAppUris.mainStyle?.fsPath ?? 'none'}`);
  log.debug(
    `Loaded tailwind browser runtime: ${webviewAppUris.tailwindBrowserScript?.fsPath ?? 'none'}`
  );
}

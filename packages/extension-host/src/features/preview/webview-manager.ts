// packages/extension-host/src/features/preview/webview-manager.ts
// webview panel lifecycle management for MDX preview

import * as path from 'path';
import * as vscode from 'vscode';
import { LogTags } from '@mdx-preview/contracts';

import { initRPCExtensionSide } from '../../platform/rpc/extension-endpoint';
import { getPreviewManager } from '../../app/services';
import { createTaggedLogger } from '../../shared/logging/logger';
import { WEBVIEW_BUILD_DIR } from '../../shared/constants';
import { getOutlineProvider } from '../language';
import type { Preview } from './Preview';
import { ensureWebviewResourcesReady } from './webview-resources';
import { setPanelHTMLFromPreview } from './webview-html';

// re-export resource initialization for activation
export {
  initWebviewAppHTMLResourcesAsync,
  initWebviewAppHTMLResources,
  ensureWebviewResourcesReady,
} from './webview-resources';

const log = createTaggedLogger(LogTags.WEBVIEW_MGR);

const VIEW_TYPE = 'mdx.preview';
const MDX_PREVIEW_FOCUS_CONTEXT_KEY = 'mdxPreviewFocus';

function dispose(): void {
  log.debug('dispose called');
  getPreviewManager().clearPanel();
}

export async function createOrShowPanel(
  preview: Preview,
  openPreview: () => Promise<void>
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
    log.debug('Initializing handshake promise');
    preview.initWebviewHandshakePromise();
    preview.webview = panel.webview;
    log.debug('Initializing RPC extension side');
    const webviewHandle = initRPCExtensionSide(
      preview,
      panel.webview,
      disposables,
      openPreview
    );
    preview.setWebviewHandle(webviewHandle);
    log.debug('RPC initialized');
    log.debug('Panel created, setting HTML');
    setPanelHTMLFromPreview(preview);

    vscode.commands.executeCommand(
      'setContext',
      MDX_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    );

    // refresh outline tree view w/ initial document
    getOutlineProvider()?.update(preview.doc);

    panel.onDidDispose(
      () => {
        log.debug('Panel disposed');
        preview.active = false;
        getOutlineProvider()?.clear();
        dispose();
        // tear down watchers & release the instance; reopen builds a fresh Preview
        preview.dispose();
        getPreviewManager().setCurrentPreview(undefined);
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
        // refresh outline when preview gains focus
        if (webviewPanel.active) {
          getOutlineProvider()?.update(preview.doc);
        }
      },
      null,
      disposables
    );
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

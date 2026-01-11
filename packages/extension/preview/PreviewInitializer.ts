// packages/extension/preview/PreviewInitializer.ts
// * Initialization logic for preview instances (watchers, handshake)

import * as vscode from 'vscode';
import { debug, error as logError } from '../logging';
import {
  DocumentTracker,
  CustomCssWatcher,
  DependencyWatcher,
  ConfigWatcher,
  WatcherManager,
} from './watchers';
import { resolveConfig, type ResolvedConfig } from './config';

export interface HandshakeResult {
  promise: Promise<void>;
  resolve: () => void;
}

// Handles initialization logic for preview instances.
// Creates & configures watchers & manages the webview handshake.
export class PreviewInitializer {
  private static readonly HANDSHAKE_TIMEOUT_MS = 10000;

  // Create a webview handshake promise w/ timeout.
  createHandshake(): HandshakeResult {
    debug('[PREVIEW] initWebviewHandshakePromise called');
    let resolveHandshake: () => void;

    const handshakePromise = new Promise<void>((resolve) => {
      resolveHandshake = () => {
        debug('[PREVIEW] Handshake resolved!');
        resolve();
      };
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        debug('[PREVIEW] Handshake TIMEOUT after 10 seconds');
        reject(
          new Error(
            'Webview handshake timeout - the preview failed to initialize within 10 seconds'
          )
        );
      }, PreviewInitializer.HANDSHAKE_TIMEOUT_MS);
    });

    const promise = Promise.race([handshakePromise, timeoutPromise]);

    return {
      promise,
      resolve: resolveHandshake!,
    };
  }

  // Initialize all watchers via WatcherManager.
  initializeWatchers(
    customCssPath: string,
    onDependencyChange: (fsPath: string) => Promise<void>
  ): WatcherManager {
    const watcherManager = new WatcherManager();

    // document tracker for version tracking
    const documentTracker = new DocumentTracker();
    watcherManager.register('document', documentTracker);

    // dependency watcher for local imports
    const dependencyWatcher = new DependencyWatcher(async (fsPath) => {
      debug(`[PREVIEW] Dependency changed: ${fsPath}`);
      await onDependencyChange(fsPath);
    });
    watcherManager.register('dependency', dependencyWatcher);

    // custom CSS watcher (if configured)
    if (customCssPath) {
      const customCssWatcher = new CustomCssWatcher(
        customCssPath,
        vscode.workspace.workspaceFolders,
        null // entryFsDirectory not available yet
      );
      watcherManager.register('customCss', customCssWatcher);
    }

    // start all watchers
    watcherManager.startAll();

    return watcherManager;
  }

  // Setup config file watcher via WatcherManager.
  setupConfigWatcher(
    watcherManager: WatcherManager,
    mdxPreviewConfig: ResolvedConfig | undefined,
    docFsPath: string,
    onConfigChange: () => void
  ): void {
    // remove existing config watcher
    watcherManager.unregister('config');

    if (!mdxPreviewConfig) {
      return;
    }

    const configPath = mdxPreviewConfig.configPath;
    const configWatcher = new ConfigWatcher(configPath, () => {
      debug('[PREVIEW] MDX config file changed, reloading...');
      onConfigChange();
    });

    watcherManager.register('config', configWatcher);
    configWatcher.start();
  }

  // Setup custom CSS file watcher via WatcherManager.
  setupCustomCssWatcher(
    watcherManager: WatcherManager,
    cssPath: string,
    entryFsDirectory: string | null,
    webviewHandle?: { setCustomCss(css: string): void }
  ): void {
    // remove existing CSS watcher
    watcherManager.unregister('customCss');

    if (!cssPath) {
      return;
    }

    const customCssWatcher = new CustomCssWatcher(
      cssPath,
      vscode.workspace.workspaceFolders,
      entryFsDirectory
    );

    // connect notifier if webview handle exists
    if (webviewHandle) {
      customCssWatcher.setNotifier(webviewHandle);
    }

    watcherManager.register('customCss', customCssWatcher);
    customCssWatcher.start();
  }
}

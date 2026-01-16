// packages/extension/preview/PreviewInitializer.ts
// initialization logic for preview instances (watchers, handshake)

import * as vscode from 'vscode';
import { debug } from '../logging';
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../constants';
import {
  DocumentTracker,
  CustomCssWatcher,
  DependencyWatcher,
  ConfigWatcher,
  TailwindConfigWatcher,
  WatcherManager,
} from './watchers';
import type { ResolvedConfig } from './config';
import { getTailwindProcessor } from '../services';

export interface HandshakeResult {
  promise: Promise<void>;
  resolve: () => void;
}

// handles initialization logic for preview instances.
// creates & configures watchers & manages the webview handshake.
export class PreviewInitializer {
  // create a webview handshake promise w/ timeout.
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
      }, WEBVIEW_HANDSHAKE_TIMEOUT_MS);
    });

    const promise = Promise.race([handshakePromise, timeoutPromise]);

    return {
      promise,
      resolve: resolveHandshake!,
    };
  }

  // Create all watchers via WatcherManager without starting them.
  // Call startWatchers() after document directory is set.
  createWatchers(
    customCssPath: string,
    onDependencyChange: (fsPath: string) => Promise<void>,
    webviewReadyPromise?: Promise<void>
  ): WatcherManager {
    const watcherManager = new WatcherManager();

    // set ready gate to prevent callbacks from firing before webview is ready
    if (webviewReadyPromise) {
      watcherManager.setReadyGate(webviewReadyPromise);
    }

    // document tracker for version tracking
    const documentTracker = new DocumentTracker();
    watcherManager.register('document', documentTracker);

    // dependency watcher for local imports - callback waits for ready gate
    const dependencyWatcher = new DependencyWatcher(async (fsPath) => {
      await watcherManager.waitForGate();
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

    // NOTE: watchers are NOT started here - call startWatchers() after setup
    return watcherManager;
  }

  // Start all watchers after document directory is set.
  async startWatchers(watcherManager: WatcherManager): Promise<void> {
    await watcherManager.startAll();
  }

  // Initialize all watchers via WatcherManager (backward compatible).
  // Prefer createWatchers() + startWatchers() for new code.
  initializeWatchers(
    customCssPath: string,
    onDependencyChange: (fsPath: string) => Promise<void>
  ): WatcherManager {
    const watcherManager = this.createWatchers(
      customCssPath,
      onDependencyChange
    );
    // Start asynchronously (fire-and-forget for backward compatibility)
    void watcherManager.startAll();
    return watcherManager;
  }

  // Setup or teardown config file watcher based on document scheme.
  // Consolidates all config watcher logic in one place.
  setupConfigWatcher(
    watcherManager: WatcherManager,
    docScheme: string,
    mdxPreviewConfig: ResolvedConfig | undefined,
    onConfigChange: () => void
  ): void {
    // always remove existing config watcher first
    watcherManager.unregister('config');

    // only set up watcher for file scheme documents w/ valid config
    if (docScheme !== 'file' || !mdxPreviewConfig) {
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

  // Setup Tailwind config watcher via WatcherManager.
  setupTailwindConfigWatcher(
    watcherManager: WatcherManager,
    watchFiles: string[],
    onChange: () => void
  ): void {
    watcherManager.unregister('tailwind');

    if (watchFiles.length === 0) {
      return;
    }

    const tailwindWatcher = new TailwindConfigWatcher(watchFiles, () => {
      debug('[PREVIEW] Tailwind config changed, reloading...');
      // Invalidate version cache when config changes (handles v3->v4 upgrades)
      getTailwindProcessor().invalidateVersionCache();
      onChange();
    });

    watcherManager.register('tailwind', tailwindWatcher);
    tailwindWatcher.start();
  }
}

// packages/extension-host/src/features/preview/PreviewInitializer.ts
// initialization logic for preview instances (watchers, handshake)

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../../shared/constants';
import {
  DocumentTracker,
  CustomCssWatcher,
  DependencyWatcher,
  EventSubscriptionWatcher,
  TailwindConfigWatcher,
  WatcherManager,
} from './watchers';
import { onConfigChange } from './configuration';
import type { ResolvedConfig } from '../types';
import { getTailwindProcessor } from '../../app/services';

export interface HandshakeResult {
  promise: Promise<void>;
  resolve: () => void;
}

// handle initialization logic for preview instances
// create & configure watchers & manage webview handshake
export class PreviewInitializer {
  // timeout ID for handshake timeout (used for cancellation)
  private handshakeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // cancel any pending handshake timeout
  // call this when reusing a panel to prevent stale timeouts from firing
  cancelHandshakeTimeout(): void {
    if (this.handshakeTimeoutId) {
      log.debug('Cancelling existing handshake timeout');
      clearTimeout(this.handshakeTimeoutId);
      this.handshakeTimeoutId = null;
    }
  }

  // create a webview handshake promise w/ timeout
  createHandshake(): HandshakeResult {
    log.debug('initWebviewHandshakePromise called');

    // cancel any existing timeout before creating a new one
    this.cancelHandshakeTimeout();

    let resolveHandshake: () => void;

    const handshakePromise = new Promise<void>((resolve) => {
      resolveHandshake = () => {
        log.debug('Handshake resolved!');
        // clear timeout on successful handshake
        this.cancelHandshakeTimeout();
        resolve();
      };
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      this.handshakeTimeoutId = setTimeout(() => {
        log.debug('Handshake TIMEOUT after 10 seconds');
        this.handshakeTimeoutId = null;
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

  // create watchers via WatcherManager w/out starting (call startWatchers() after doc dir set)
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
      log.debug(`Dependency changed: ${fsPath}`);
      await onDependencyChange(fsPath);
    });
    watcherManager.register('dependency', dependencyWatcher);

    // custom CSS watcher (if configured)
    if (customCssPath) {
      // entryFsDirectory not available yet, pass null
      const customCssWatcher = new CustomCssWatcher(
        customCssPath,
        vscode.workspace.workspaceFolders,
        null
      );
      watcherManager.register('customCss', customCssWatcher);
    }

    // NOTE: watchers are NOT started here - call startWatchers() after setup
    return watcherManager;
  }

  // start all watchers after document directory is set
  async startWatchers(watcherManager: WatcherManager): Promise<void> {
    await watcherManager.startAll();
  }

  // setup config change subscription (subscribe to ConfigCache events from ConfigResolver)
  setupConfigWatcher(
    watcherManager: WatcherManager,
    docScheme: string,
    mdxPreviewConfig: ResolvedConfig | undefined,
    onConfigChanged: () => void
  ): void {
    // always remove existing config watcher first
    watcherManager.unregister('config');

    // only set up watcher for file scheme documents w/ valid config
    if (docScheme !== 'file' || !mdxPreviewConfig) {
      return;
    }

    const configPath = mdxPreviewConfig.configPath;

    const configSubscriptionWatcher = new EventSubscriptionWatcher({
      logTag: LogTags.CONFIG_SUBSCRIPTION,
      subscribe: () =>
        onConfigChange((event) => {
          if (event.configPath === configPath) {
            log.debug('MDX config file changed, reloading...');
            onConfigChanged();
          }
        }),
    });

    watcherManager.register('config', configSubscriptionWatcher);
    configSubscriptionWatcher.start();
  }

  // setup custom CSS file watcher via WatcherManager
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

  // setup Tailwind config watcher via WatcherManager
  setupTailwindConfigWatcher(
    watcherManager: WatcherManager,
    watchFiles: string[],
    onChange: (changedPaths: string[]) => void
  ): void {
    watcherManager.unregister('tailwind');

    if (watchFiles.length === 0) {
      return;
    }

    const tailwindWatcher = new TailwindConfigWatcher(
      watchFiles,
      (changedPaths) => {
        log.debug('Tailwind config changed, reloading...');
        const tailwindProcessor = getTailwindProcessor();
        // invalidate version cache when config changes (handle v3->v4 upgrades)
        tailwindProcessor.invalidateVersionCache();
        // invalidate detection cache for config & entry CSS paths
        tailwindProcessor.invalidateDetectionCaches(changedPaths);
        // invalidate scan cache for changed files
        for (const fsPath of changedPaths) {
          tailwindProcessor.invalidateScanCache(fsPath);
        }
        onChange(changedPaths);
      }
    );

    watcherManager.register('tailwind', tailwindWatcher);
    tailwindWatcher.start();
  }
}

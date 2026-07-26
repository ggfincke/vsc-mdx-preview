// packages/extension-host/src/features/preview/PreviewInitializer.ts
// initialization logic for preview instances (watchers, handshake)

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger
const log = createTaggedLogger(LogTags.PREVIEW);
import { WEBVIEW_HANDSHAKE_TIMEOUT_MS } from '../../shared/constants';
import { DocumentTracker } from './watchers/DocumentTracker';
import { CustomCssWatcher } from './watchers/CustomCssWatcher';
import { DependencyWatcher } from './watchers/DependencyWatcher';
import { EventSubscriptionWatcher } from './watchers/EventSubscriptionWatcher';
import { TailwindConfigWatcher } from './watchers/TailwindConfigWatcher';
import { WatcherManager } from './watchers/WatcherManager';
import {
  getConfigCandidatePaths,
  onConfigChange,
} from './configuration/ConfigResolver';
import { onTypeScriptConfigChange } from './configuration/TypeScriptConfigResolver';
import { getTailwindProcessor } from '../../app/services';

export interface HandshakeResult {
  promise: Promise<void>;
  resolve: () => void;
}

// distinguishable timeout failure so callers can offer recovery UI
export class HandshakeTimeoutError extends Error {
  constructor() {
    super(
      'Webview handshake timeout - the preview failed to initialize within 10 seconds'
    );
    this.name = 'HandshakeTimeoutError';
  }
}

// handle initialization logic for preview instances
// create & configure watchers & manage webview handshake
export class PreviewInitializer {
  // timeout ID for handshake timeout (used for cancellation)
  private handshakeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private handshakeTimedOut = false;

  // report & clear whether the current handshake already timed out
  consumeHandshakeTimeout(): boolean {
    const timedOut = this.handshakeTimedOut;
    this.handshakeTimedOut = false;
    return timedOut;
  }

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
    this.handshakeTimedOut = false;

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
        this.handshakeTimedOut = true;
        reject(new HandshakeTimeoutError());
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
    documentPath: string,
    onConfigChanged: () => void
  ): void {
    // always remove existing config watcher first
    watcherManager.unregister('config');

    if (docScheme !== 'file') {
      return;
    }

    const configCandidatePaths = new Set(getConfigCandidatePaths(documentPath));

    const configSubscriptionWatcher = new EventSubscriptionWatcher({
      logTag: LogTags.CONFIG_SUBSCRIPTION,
      subscribe: () =>
        onConfigChange((event) => {
          if (configCandidatePaths.has(event.configPath)) {
            log.debug('MDX config file changed, reloading...');
            onConfigChanged();
          }
        }),
    });

    watcherManager.register('config', configSubscriptionWatcher);
    configSubscriptionWatcher.start();
  }

  setupTypeScriptConfigWatcher(
    watcherManager: WatcherManager,
    docScheme: string,
    onConfigChanged: () => void
  ): void {
    watcherManager.unregister('typescriptConfig');

    if (docScheme !== 'file') {
      return;
    }

    const configSubscriptionWatcher = new EventSubscriptionWatcher({
      logTag: LogTags.TS_CONFIG,
      subscribe: () =>
        onTypeScriptConfigChange(() => {
          log.debug('TypeScript config file changed, reloading...');
          onConfigChanged();
        }),
    });

    watcherManager.register('typescriptConfig', configSubscriptionWatcher);
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

  dispose(): void {
    this.cancelHandshakeTimeout();
  }
}

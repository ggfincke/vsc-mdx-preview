// packages/extension/preview/PreviewWatcherCoordinator.ts
// coordinates watcher setup/teardown for preview lifecycle

import { error as logError } from '../logging';
import type { WatcherManager } from './watchers';
import type { PreviewInitializer } from './PreviewInitializer';
import type { PreviewDocumentHandler } from './PreviewDocumentHandler';
import type { WebviewHandle } from './PreviewWebviewBridge';
import type { ResolvedConfig } from './config';

// watcher coordinator - manages watcher lifecycle for a preview
// delegates actual watcher creation/setup to PreviewInitializer
export class PreviewWatcherCoordinator {
  constructor(
    private initializer: PreviewInitializer,
    private watcherManager: WatcherManager
  ) {}

  // setup config watcher for MDX preview config file (.mdx-previewrc.json)
  // - triggers reload callback when config changes
  setupConfigWatcher(
    docScheme: string,
    mdxPreviewConfig: ResolvedConfig | undefined,
    documentHandler: PreviewDocumentHandler,
    onRefresh: () => Promise<void>
  ): void {
    this.initializer.setupConfigWatcher(
      this.watcherManager,
      docScheme,
      mdxPreviewConfig,
      () => {
        documentHandler.reloadMdxConfig();
        onRefresh().catch((err) =>
          logError('Failed to refresh after config change', err)
        );
      }
    );
  }

  // setup Tailwind config watcher for tailwind.config.js etc.
  // - triggers update callback when config changes
  setupTailwindConfigWatcher(
    watchFiles: string[],
    onUpdate: () => Promise<void>
  ): void {
    this.initializer.setupTailwindConfigWatcher(
      this.watcherManager,
      watchFiles,
      () => {
        onUpdate().catch((err) =>
          logError('Failed to refresh after Tailwind change', err)
        );
      }
    );
  }

  // setup custom CSS watcher
  // - watches user-specified custom CSS file for changes
  setupCustomCssWatcher(
    cssPath: string,
    entryFsDirectory: string | null,
    webviewHandle?: WebviewHandle
  ): void {
    this.initializer.setupCustomCssWatcher(
      this.watcherManager,
      cssPath,
      entryFsDirectory,
      webviewHandle
    );
  }

  // get watcher manager for direct access
  getWatcherManager(): WatcherManager {
    return this.watcherManager;
  }

  // dispose all watchers
  dispose(): void {
    this.watcherManager.dispose();
  }
}

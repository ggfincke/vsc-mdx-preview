// packages/extension/preview/watchers/ConfigWatcher.ts
// Watch MDX preview config file (.mdx-previewrc.json) for changes

import * as vscode from 'vscode';
import { debug } from '../../logging';
import { onConfigChange } from '../config';
import { BaseWatcher } from './BaseWatcher';

// watch for changes to the MDX preview config file & trigger callback when modified
export class ConfigWatcher extends BaseWatcher {
  protected readonly logTag = 'CONFIG-WATCHER';
  private configChangeDisposable?: vscode.Disposable;

  constructor(
    private configPath: string,
    private onConfigChanged: () => void
  ) {
    super();
  }

  // update the config path being watched (automatically restarts watching if currently active)
  setConfigPath(configPath: string): void {
    const wasActive = this._isActive;
    if (wasActive) {
      this.stop();
    }
    this.configPath = configPath;
    if (wasActive) {
      this.start();
    }
  }

  protected canStart(): boolean {
    return !!this.configPath;
  }

  protected onStart(): void {
    this.configChangeDisposable = onConfigChange((event) => {
      if (event.configPath === this.configPath) {
        debug('[CONFIG-WATCHER] Config file changed, triggering reload...');
        this.onConfigChanged();
      }
    });
    debug(`[CONFIG-WATCHER] Watching: ${this.configPath}`);
  }

  protected onStop(): void {
    this.configChangeDisposable?.dispose();
    this.configChangeDisposable = undefined;
  }
}

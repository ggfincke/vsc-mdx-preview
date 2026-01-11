// packages/extension/preview/watchers/ConfigWatcher.ts
// Watch MDX preview config file (.mdx-previewrc.json) for changes

import * as vscode from 'vscode';
import { debug } from '../../logging';
import { onConfigChange } from '../config';
import type { IWatcher } from './types';

// watch for changes to the MDX preview config file & trigger callback when modified
export class ConfigWatcher implements IWatcher {
  private configChangeDisposable?: vscode.Disposable;
  private _isActive = false;

  constructor(
    private configPath: string,
    private onConfigChanged: () => void
  ) {}

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

  // IWatcher interface implementation

  start(): void {
    if (this._isActive || !this.configPath) {
      return;
    }

    this._isActive = true;

    this.configChangeDisposable = onConfigChange((changedPath) => {
      if (changedPath === this.configPath) {
        debug('[CONFIG-WATCHER] Config file changed, triggering reload...');
        this.onConfigChanged();
      }
    });

    debug(`[CONFIG-WATCHER] Started watching: ${this.configPath}`);
  }

  stop(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this.configChangeDisposable?.dispose();
    this.configChangeDisposable = undefined;

    debug('[CONFIG-WATCHER] Stopped');
  }

  isActive(): boolean {
    return this._isActive;
  }

  dispose(): void {
    this.stop();
  }
}

// packages/extension-host/src/features/preview/watchers/FilePathWatcher.ts
// wrap single-pattern file watchers w/ BaseWatcher

import type * as vscode from 'vscode';
import type { LogTag } from '@mdx-preview/contracts';
import { BaseWatcher } from './BaseWatcher';

export interface FilePathWatcherConfig {
  // set glob pattern or file path to watch
  pattern: string | vscode.GlobPattern;
  // set log tag for error wrapping
  logTag: LogTag;
  // handle watched file changes
  onChange?: (uri: vscode.Uri) => void;
  // handle watched file creation
  onCreate?: (uri: vscode.Uri) => void;
  // handle watched file deletion
  onDelete?: (uri: vscode.Uri) => void;
  // skip create events
  ignoreCreateEvents?: boolean;
  // skip change events
  ignoreChangeEvents?: boolean;
  // skip delete events
  ignoreDeleteEvents?: boolean;
  // wrap handlers in try-catch w/ error logging
  wrapErrors?: boolean;
}

// wrap single file or glob patterns
export class FilePathWatcher extends BaseWatcher {
  protected readonly logTag: LogTag;
  private watcher?: vscode.FileSystemWatcher;
  private config: FilePathWatcherConfig;

  constructor(config: FilePathWatcherConfig) {
    super();
    this.logTag = config.logTag;
    this.config = config;
  }

  protected onStart(): void {
    this.watcher = this.createFileWatcher(this.config.pattern, {
      onChange: this.config.onChange,
      onCreate: this.config.onCreate,
      onDelete: this.config.onDelete,
      ignoreCreateEvents: this.config.ignoreCreateEvents,
      ignoreChangeEvents: this.config.ignoreChangeEvents,
      ignoreDeleteEvents: this.config.ignoreDeleteEvents,
      wrapErrors: this.config.wrapErrors,
    });

    this.markReady();
  }

  protected onStop(): void {
    this.disposeWatcher(this.watcher);
    this.watcher = undefined;
  }
}

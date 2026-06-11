// packages/extension-host/src/features/preview/types/watcher.ts
// type definitions for file watchers & config change events

import type * as vscode from 'vscode';

// common interface for all watchers
// provide unified lifecycle management (start/stop/dispose)
export interface IWatcher extends vscode.Disposable {
  // start watching & initialize (returns promise when ready)
  start(): Promise<void>;

  // stop watching w/o disposing (can restart later w/ start())
  stop(): void;

  // check if the watcher is currently active
  isActive(): boolean;

  // check if the watcher is fully initialized & ready to handle events
  isReady(): boolean;

  // wait for the watcher to become ready (Promise-based, no polling)
  waitForReady(timeoutMs?: number): Promise<void>;
}

// typed config change event types
export enum ConfigChangeType {
  FileChanged = 'fileChanged',
  FileDeleted = 'fileDeleted',
  FileCreated = 'fileCreated',
}

// typed config change event
export interface ConfigChangeEvent {
  type: ConfigChangeType;
  configPath: string;
  timestamp: number;
}

// callback type for config change notifications
export type ConfigChangeCallback = (event: ConfigChangeEvent) => void;

// re-export FileWatcherConfig from canonical location (utils/createFileWatcher.ts)
export { type FileWatcherConfig } from '../../../shared/utils/createFileWatcher';

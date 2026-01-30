// packages/extension/types/vscode/watcher.ts
// type definitions for file watchers & config change events

import type * as vscode from 'vscode';

// common interface for all watchers
// provides unified lifecycle management (start/stop/dispose)
export interface IWatcher extends vscode.Disposable {
  // start watching & initialize (returns promise when ready)
  start(): Promise<void>;

  // stop watching without disposing (can restart later w/ start())
  stop(): void;

  // check if the watcher is currently active
  isActive(): boolean;

  // check if the watcher is fully initialized & ready to handle events
  isReady(): boolean;

  // wait for the watcher to become ready (Promise-based, no polling)
  waitForReady(timeoutMs?: number): Promise<void>;
}

// type guard for checking if an object implements IWatcher
export function isWatcher(obj: unknown): obj is IWatcher {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'start' in obj &&
    'stop' in obj &&
    'isActive' in obj &&
    'isReady' in obj &&
    'waitForReady' in obj &&
    'dispose' in obj &&
    typeof (obj as IWatcher).start === 'function' &&
    typeof (obj as IWatcher).stop === 'function' &&
    typeof (obj as IWatcher).isActive === 'function' &&
    typeof (obj as IWatcher).isReady === 'function' &&
    typeof (obj as IWatcher).waitForReady === 'function' &&
    typeof (obj as IWatcher).dispose === 'function'
  );
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

// options for creating a file watcher
export interface FileWatcherConfig {
  // glob pattern or relative pattern to watch
  pattern: string | vscode.GlobPattern;
  // handler called when a watched file changes
  onChange?: (uri: vscode.Uri) => void;
  // handler called when a watched file is created
  onCreate?: (uri: vscode.Uri) => void;
  // handler called when a watched file is deleted
  onDelete?: (uri: vscode.Uri) => void;
  // skip firing create events (default: false)
  ignoreCreateEvents?: boolean;
  // skip firing change events (default: false)
  ignoreChangeEvents?: boolean;
  // skip firing delete events (default: false)
  ignoreDeleteEvents?: boolean;
  // wrap handlers in try-catch w/ error logging (default: true)
  wrapErrors?: boolean;
  // tag for debug logging (e.g., 'TSCONFIG', 'CSS'). Required if wrapErrors is true
  logTag?: string;
}

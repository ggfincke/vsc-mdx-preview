// packages/extension/preview/watchers/types.ts
// common interface for all watchers

import type { Disposable } from 'vscode';

// common interface for all watchers.
// provides unified lifecycle management (start/stop/dispose).
export interface IWatcher extends Disposable {
  // Start watching.
  // Called when the watcher should begin monitoring for changes.
  start(): void;

  // Stop watching without disposing resources.
  // Can be restarted later w/ start().
  stop(): void;

  // Check if the watcher is currently active.
  // @returns true if watching, false if stopped
  isActive(): boolean;
}

// type guard for checking if an object implements IWatcher.
export function isWatcher(obj: unknown): obj is IWatcher {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'start' in obj &&
    'stop' in obj &&
    'isActive' in obj &&
    'dispose' in obj &&
    typeof (obj as IWatcher).start === 'function' &&
    typeof (obj as IWatcher).stop === 'function' &&
    typeof (obj as IWatcher).isActive === 'function' &&
    typeof (obj as IWatcher).dispose === 'function'
  );
}

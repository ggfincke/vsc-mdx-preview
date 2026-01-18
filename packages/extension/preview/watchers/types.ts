// packages/extension/preview/watchers/types.ts
// common interface for all watchers

import type { Disposable } from 'vscode';

// common interface for all watchers.
// provides unified lifecycle management (start/stop/dispose).
export interface IWatcher extends Disposable {
  // Start watching.
  // Called when the watcher should begin monitoring for changes.
  // Returns a promise that resolves when the watcher is fully initialized.
  start(): Promise<void>;

  // Stop watching without disposing resources.
  // Can be restarted later w/ start().
  stop(): void;

  // Check if the watcher is currently active.
  // @returns true if watching, false if stopped
  isActive(): boolean;

  // check if the watcher is fully initialized & ready to handle events
  // @returns true if ready to receive & process events
  isReady(): boolean;

  // Wait for the watcher to become ready (Promise-based, no polling).
  // @param timeoutMs - Optional timeout in milliseconds
  // @returns Promise that resolves when ready, rejects on timeout
  waitForReady(timeoutMs?: number): Promise<void>;
}

// type guard for checking if an object implements IWatcher.
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

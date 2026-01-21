// packages/extension/preview/watchers/types.ts
// common interface for all watchers
//
// ## Config Watching Architecture
//
// The config watching system uses a broadcast pattern:
// 1. ConfigResolver.setupConfigWatcher() - Creates VS Code FileSystemWatcher for config files
// 2. ConfigCache - Central broadcast point that receives & notifies of config changes
// 3. PreviewInitializer.setupConfigWatcher() - Creates IWatcher adapters that subscribe to ConfigCache
//
// This avoids duplicate file watchers - one watcher per config file, multiple subscribers.

import type { Disposable } from 'vscode';

// common interface for all watchers
// provides unified lifecycle management (start/stop/dispose)
export interface IWatcher extends Disposable {
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

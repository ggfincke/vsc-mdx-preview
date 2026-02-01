// packages/extension/utils/createFileWatcher.ts
// Standalone file watcher factory w/ error wrapping
//
// Extracted from BaseWatcher for reuse in standalone watchers that don't
// need full BaseWatcher lifecycle management
//
// USAGE
// ```typescript
// import { createFileWatcher } from '../utils/createFileWatcher';
//
// const watcher = createFileWatcher({
//   pattern: '**/tsconfig.json',
//   onChange: (uri) => { console.log('Changed:', uri.fsPath); },
//   logTag: LogTags.TS_CONFIG,
// });
// ```

import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging';
import { LogTags, type LogTag } from '@mdx-preview/shared';

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
  // use log tag for debug logging (e.g., LogTags.TS_CONFIG, LogTags.CSS) required if wrapErrors is true
  logTag?: LogTag;
}

// create a VS Code file system watcher w/ standard error handling
// features
// - optional error wrapping for handlers (prevents uncaught exceptions)
// - debug logging for errors w/ configurable tag
// - consistent event handling pattern
export function createFileWatcher(
  config: FileWatcherConfig
): vscode.FileSystemWatcher {
  const {
    pattern,
    wrapErrors = true,
    logTag,
    ignoreCreateEvents = false,
    ignoreChangeEvents = false,
    ignoreDeleteEvents = false,
  } = config;

  const watcher = vscode.workspace.createFileSystemWatcher(
    pattern,
    ignoreCreateEvents,
    ignoreChangeEvents,
    ignoreDeleteEvents
  );

  // create tagged logger for error messages
  const logger = createTaggedLogger(logTag ?? LogTags.WATCHER);

  // helper to wrap handler w/ error handling
  const wrapHandler = (
    handler: ((uri: vscode.Uri) => void) | undefined,
    eventType: string
  ): ((uri: vscode.Uri) => void) | undefined => {
    if (!handler) {
      return undefined;
    }
    if (!wrapErrors) {
      return handler;
    }
    return (uri: vscode.Uri) => {
      try {
        handler(uri);
      } catch (error) {
        logger.debug(`Error in ${eventType} handler: ${error}`);
      }
    };
  };

  const onChange = wrapHandler(config.onChange, 'change');
  const onCreate = wrapHandler(config.onCreate, 'create');
  const onDelete = wrapHandler(config.onDelete, 'delete');

  if (onChange) {
    watcher.onDidChange(onChange);
  }
  if (onCreate) {
    watcher.onDidCreate(onCreate);
  }
  if (onDelete) {
    watcher.onDidDelete(onDelete);
  }

  return watcher;
}

// create multiple file watchers for different patterns
// convenience function when watching multiple patterns w/ similar handlers
export function createFileWatchers(
  configs: FileWatcherConfig[]
): vscode.FileSystemWatcher[] {
  return configs.map(createFileWatcher);
}

// create a watcher & add it to a disposables array
// convenience function for the common pattern of creating a watcher &
// adding it to a disposables collection
export function createManagedFileWatcher(
  config: FileWatcherConfig,
  disposables: vscode.Disposable[]
): vscode.FileSystemWatcher {
  const watcher = createFileWatcher(config);
  disposables.push(watcher);
  return watcher;
}

// packages/extension/utils/createFileWatcher.ts
// standalone file watcher factory w/ error wrapping & optional debouncing

import debounce from 'lodash.debounce';
import * as vscode from 'vscode';
import { createTaggedLogger } from '../logging/logger';
import { type LogTag, LogTags } from '@mdx-preview/contracts';

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
  // debounce ms
  debounceMs?: number;
}

// debounced watcher handle (extends FileSystemWatcher w/ cancel method)
export interface DebouncedFileSystemWatcher extends vscode.FileSystemWatcher {
  // cancel any pending debounced calls (call on dispose if using debounce)
  cancelPending?: () => void;
}

// create a VS Code file system watcher w/ standard error handling
// features
// - optional error wrapping for handlers (prevents uncaught exceptions)
// - optional debouncing for change events
// - debug logging for errors w/ configurable tag
// - consistent event handling pattern
export function createFileWatcher(
  config: FileWatcherConfig
): DebouncedFileSystemWatcher {
  const {
    pattern,
    wrapErrors = true,
    logTag,
    ignoreCreateEvents = false,
    ignoreChangeEvents = false,
    ignoreDeleteEvents = false,
    debounceMs,
  } = config;

  const watcher = vscode.workspace.createFileSystemWatcher(
    pattern,
    ignoreCreateEvents,
    ignoreChangeEvents,
    ignoreDeleteEvents
  ) as DebouncedFileSystemWatcher;

  // create tagged logger for error messages
  const logger = createTaggedLogger(logTag ?? LogTags.WATCHER);

  // track debounced functions for cleanup
  const debouncedFns: ReturnType<typeof debounce>[] = [];

  // helper to wrap handler w/ error handling & optional debounce
  const wrapHandler = (
    handler: ((uri: vscode.Uri) => void) | undefined,
    eventType: string,
    shouldDebounce: boolean
  ): ((uri: vscode.Uri) => void) | undefined => {
    if (!handler) {
      return undefined;
    }

    // wrap w/ error handling
    let wrappedHandler: (uri: vscode.Uri) => void;
    if (wrapErrors) {
      wrappedHandler = (uri: vscode.Uri) => {
        try {
          handler(uri);
        } catch (error: unknown) {
          logger.debug(`Error in ${eventType} handler: ${error}`);
        }
      };
    } else {
      wrappedHandler = handler;
    }

    // wrap w/ debounce if requested
    if (shouldDebounce && debounceMs !== undefined && debounceMs > 0) {
      const debouncedHandler = debounce(wrappedHandler, debounceMs);
      debouncedFns.push(debouncedHandler);
      return debouncedHandler;
    }

    return wrappedHandler;
  };

  // only debounce change events (create/delete are typically one-time events)
  const onChange = wrapHandler(config.onChange, 'change', true);
  const onCreate = wrapHandler(config.onCreate, 'create', false);
  const onDelete = wrapHandler(config.onDelete, 'delete', false);

  if (onChange) {
    watcher.onDidChange(onChange);
  }
  if (onCreate) {
    watcher.onDidCreate(onCreate);
  }
  if (onDelete) {
    watcher.onDidDelete(onDelete);
  }

  // add cancel method for debounced calls
  if (debouncedFns.length > 0) {
    watcher.cancelPending = () => {
      for (const fn of debouncedFns) {
        fn.cancel();
      }
    };
  }

  return watcher;
}

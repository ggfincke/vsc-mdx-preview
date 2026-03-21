// packages/extension-host/src/shared/utils/createFileWatcher.ts
// standalone file watcher factory w/ error wrapping
// debouncing owned by BaseWatcher.createDebouncedHandler()

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
  // auto-log file events before calling handlers (default: false)
  enableEventLogging?: boolean;
  // use log tag for debug logging (e.g., LogTags.TS_CONFIG, LogTags.CSS) required if wrapErrors is true
  logTag?: LogTag;
}

// create a VS Code file system watcher w/ standard error handling
export function createFileWatcher(
  config: FileWatcherConfig
): vscode.FileSystemWatcher {
  const {
    pattern,
    wrapErrors = true,
    enableEventLogging = false,
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

  // helper to wrap handler w/ event logging & error handling
  const wrapHandler = (
    handler: ((uri: vscode.Uri) => void) | undefined,
    eventType: string
  ): ((uri: vscode.Uri) => void) | undefined => {
    if (!handler) {
      return undefined;
    }

    if (wrapErrors) {
      return (uri: vscode.Uri) => {
        try {
          if (enableEventLogging) {
            logger.debug(`File ${eventType}: ${uri.fsPath}`);
          }
          handler(uri);
        } catch (error: unknown) {
          logger.debug(`Error in file ${eventType} handler: ${error}`);
        }
      };
    }

    if (enableEventLogging) {
      return (uri: vscode.Uri) => {
        logger.debug(`File ${eventType}: ${uri.fsPath}`);
        handler(uri);
      };
    }

    return handler;
  };

  const onChange = wrapHandler(config.onChange, 'changed');
  const onCreate = wrapHandler(config.onCreate, 'created');
  const onDelete = wrapHandler(config.onDelete, 'deleted');

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

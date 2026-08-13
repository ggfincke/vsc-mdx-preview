// packages/extension-host/src/shared/utils/createFileWatcher.ts
// standalone watcher factory w/ error wrapping & external debounce ownership

import * as vscode from 'vscode';
import * as path from 'path';
import { createTaggedLogger } from '../logging/logger';
import { type LogTag, LogTags } from '@mdx-preview/contracts';

type FileWatcherHandler = (uri: vscode.Uri) => void | Promise<void>;

// options for creating a file watcher
export interface FileWatcherConfig {
  // glob pattern or relative pattern to watch
  pattern: string | vscode.GlobPattern;
  // handler called when a watched file changes
  onChange?: FileWatcherHandler;
  // handler called when a watched file is created
  onCreate?: FileWatcherHandler;
  // handler called when a watched file is deleted
  onDelete?: FileWatcherHandler;
  // skip firing create events (default: false)
  ignoreCreateEvents?: boolean;
  // skip firing change events (default: false)
  ignoreChangeEvents?: boolean;
  // skip firing delete events (default: false)
  ignoreDeleteEvents?: boolean;
  // auto-log file events before calling handlers (default: false)
  enableEventLogging?: boolean;
  // use log tag for debug logging (e.g., LogTags.TS_CONFIG, LogTags.CSS)
  logTag?: LogTag;
}

// build an exact-file RelativePattern w/o treating path text as glob syntax
export function createExactFileWatcherPattern(
  filePath: string
): vscode.RelativePattern {
  const absolutePath = path.resolve(filePath);
  const basenamePattern = path
    .basename(absolutePath)
    .replace(/[[\]{}*?]/g, (character) => {
      if (character === '[') {
        return '[[]';
      }
      if (character === ']') {
        return '[]]';
      }
      return `[${character}]`;
    });
  return new vscode.RelativePattern(
    vscode.Uri.file(path.dirname(absolutePath)),
    basenamePattern
  );
}

// create a VS Code file system watcher w/ standard error handling
export function createFileWatcher(
  config: FileWatcherConfig
): vscode.FileSystemWatcher {
  const {
    pattern,
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
    handler: FileWatcherHandler | undefined,
    eventType: string
  ): ((uri: vscode.Uri) => Promise<void>) | undefined => {
    if (!handler) {
      return undefined;
    }

    return async (uri: vscode.Uri) => {
      try {
        if (enableEventLogging) {
          logger.debug(`File ${eventType}: ${uri.fsPath}`);
        }
        await handler(uri);
      } catch (error: unknown) {
        logger.error(`Error in file ${eventType} handler`, error);
      }
    };
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

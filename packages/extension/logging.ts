// packages/extension/logging.ts
// centralized logging using VS Code's OutputChannel for user-visible logs

import * as vscode from 'vscode';
import type { Logger, TaggedLogger, LogTag } from '@mdx-preview/shared';
import { LogLevel, LogTags } from '@mdx-preview/shared';

// debug logging state (mutable for reactive updates)
let debugEnabled = false;

// track activation time for elapsed timing in debug messages
let activationTime: number | undefined;

let outputChannel: vscode.OutputChannel | undefined;

// get or create output channel for extension
export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('MDX Preview');
  }
  return outputChannel;
}

// check if debug logging is enabled
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

// initialize logging w/ ConfigManager subscription
// call after ConfigManager is registered in ServiceRegistry
export function initLogging(): vscode.Disposable {
  // set activation time for elapsed tracking
  activationTime = Date.now();

  // avoid circular import by using dynamic require
  // ConfigManager is already registered by this point

  const { getConfigManager } =
    require('./services') as typeof import('./services');

  const configManager = getConfigManager();

  // read initial value from setting
  debugEnabled = configManager.get('advanced.debugOutput');

  // subscribe to setting changes
  const subscription = configManager.onDidChangeKey(
    'advanced.debugOutput',
    () => {
      debugEnabled = configManager.get('advanced.debugOutput');

      if (debugEnabled) {
        info(`[${LogTags.LOGGING}] Debug output enabled via settings`);
        showOutput();
      }
    }
  );

  return {
    dispose: () => {
      subscription.dispose();
    },
  };
}

// format elapsed time since activation
function formatElapsed(): string {
  if (!activationTime) {
    return '';
  }
  const elapsed = Date.now() - activationTime;
  return `(+${elapsed}ms)`;
}

// format data for logging w/ improved readability
function formatData(data: unknown): string {
  if (data === undefined) {
    return '';
  }

  try {
    // handle Error objects specially
    if (data instanceof Error) {
      const stack = data.stack ? `\n  Stack: ${data.stack}` : '';
      return `\n  Error: ${data.message}${stack}`;
    }

    if (typeof data === 'object' && data !== null) {
      // truncate long arrays for readability
      const serialized = JSON.stringify(
        data,
        (_key, value) => {
          if (Array.isArray(value) && value.length > 10) {
            return [...value.slice(0, 10), `... (${value.length - 10} more)`];
          }
          return value;
        },
        2
      );
      return '\n' + serialized;
    }

    return '\n  ' + String(data);
  } catch {
    return '\n  [unserializable data]';
  }
}

// log message to output channel
export function log(level: LogLevel, message: string, data?: unknown): void {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();

  // add elapsed time for debug messages only
  const elapsed = level === LogLevel.Debug ? ` ${formatElapsed()}` : '';
  const formattedMessage = `[${timestamp}] [${level}]${elapsed} ${message}`;

  if (data !== undefined) {
    channel.appendLine(`${formattedMessage}${formatData(data)}`);
  } else {
    channel.appendLine(formattedMessage);
  }
}

// log debug message (skipped when debugEnabled is false)
export function debug(message: string, data?: unknown): void {
  if (!debugEnabled) {
    return;
  }
  log(LogLevel.Debug, message, data);
}

// log debug message w/ lazy evaluation (message function only called when debug is enabled)
// use for hot paths where string construction overhead matters
export function debugLazy(messageFn: () => string, data?: unknown): void {
  if (!debugEnabled) {
    return;
  }
  log(LogLevel.Debug, messageFn(), data);
}

// log info message
export function info(message: string, data?: unknown): void {
  log(LogLevel.Info, message, data);
}

// log warning message
export function warn(message: string, data?: unknown): void {
  log(LogLevel.Warn, message, data);
}

// log error message
export function error(message: string, data?: unknown): void {
  log(LogLevel.Error, message, data);
}

// show output channel to user
export function showOutput(): void {
  getOutputChannel().show();
}

// dispose output channel (call during extension deactivation)
export function disposeOutputChannel(): void {
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = undefined;
  }
}

// create a tagged logger w/ a fixed prefix for consistent debug output
// all methods write to the OutputChannel w/ the tag prefix
export function createTaggedLogger(tag: LogTag): TaggedLogger {
  const prefix = `[${tag}]`;

  return {
    debug: (...args: unknown[]) => {
      const [message, data] = args;
      debug(`${prefix} ${String(message ?? '')}`, data);
    },
    info: (...args: unknown[]) => {
      const [message, data] = args;
      info(`${prefix} ${String(message ?? '')}`, data);
    },
    warn: (...args: unknown[]) => {
      const [message, data] = args;
      warn(`${prefix} ${String(message ?? '')}`, data);
    },
    error: (...args: unknown[]) => {
      const [message, data] = args;
      error(`${prefix} ${String(message ?? '')}`, data);
    },
  };
}

// default logger instance (module-level functions as object)
export const logger: Logger = {
  debug,
  info,
  warn,
  error,
};

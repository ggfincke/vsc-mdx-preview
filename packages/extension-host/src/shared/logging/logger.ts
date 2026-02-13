// packages/extension/logging.ts
// centralized logging using VS Code's OutputChannel for user-visible logs

import * as vscode from 'vscode';
import type { Logger } from '@mdx-preview/contracts';
import {
  LogLevel,
  LogTags,
  createTaggedLoggerFactory,
} from '@mdx-preview/contracts';
// import from setting-keys (not ConfigManager) to avoid circular deps
import { SETTINGS } from '../config/setting-keys';

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
    require('../../app/services') as typeof import('../../app/services');

  const configManager = getConfigManager();

  // read initial value from setting
  debugEnabled = configManager.get(SETTINGS.DEBUG_OUTPUT);

  // subscribe to setting changes
  const subscription = configManager.onDidChangeKey(
    SETTINGS.DEBUG_OUTPUT,
    () => {
      debugEnabled = configManager.get(SETTINGS.DEBUG_OUTPUT);

      if (debugEnabled) {
        createTaggedLogger(LogTags.LOGGING).info(
          'Debug output enabled via settings'
        );
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

// create variadic wrapper that adapts variadic calls to (message, data) format
function createVariadicWrapper(
  logFn: (message: string, data?: unknown) => void
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const [first, ...rest] = args;
    const message = String(first ?? '');
    const data =
      rest.length === 1 ? rest[0] : rest.length > 1 ? rest : undefined;
    logFn(message, data);
  };
}

// variadic logger for use w/ shared factory
const variadicLogger = {
  debug: createVariadicWrapper(debug),
  info: createVariadicWrapper(info),
  warn: createVariadicWrapper(warn),
  error: createVariadicWrapper(error),
};

// create tagged logger using shared factory w/ extension's variadic wrapper
// prefix is prepended to first argument (becomes part of message)
export const createTaggedLogger = createTaggedLoggerFactory(variadicLogger);

// default logger instance (module-level functions as object)
export const logger: Logger = {
  debug,
  info,
  warn,
  error,
};

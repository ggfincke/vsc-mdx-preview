// packages/extension/logging.ts
// centralized logging using VS Code's OutputChannel for user-visible logs

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

// get or create output channel for extension
export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('MDX Preview');
  }
  return outputChannel;
}

// log levels for extension
export enum LogLevel {
  Debug = 'DEBUG',
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
}

// log message to output channel
export function log(level: LogLevel, message: string, data?: unknown): void {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;

  if (data !== undefined) {
    const dataStr =
      typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    channel.appendLine(`${formattedMessage}\n${dataStr}`);
  } else {
    channel.appendLine(formattedMessage);
  }
}

// log debug message
export function debug(message: string, data?: unknown): void {
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

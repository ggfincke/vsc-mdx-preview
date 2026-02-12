// packages/extension/utils/file-utils.ts
// centralized file I/O utilities w/ consistent error handling
//
// error handling strategy
// - all functions return null/undefined on failure (never throw)
// - optional debug logging via options parameter
// - consistent error message format for troubleshooting

import * as fs from 'fs';
import { createTaggedLogger } from '../logging/logger';
import { type TaggedLogger, LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { raceTimeout } from './async-utils';

// default logger for file operations
const defaultLog = createTaggedLogger(LogTags.FILE);

// options for file operations
export interface FileOptions {
  // enable debug logging on failure (default: false)
  logOnError?: boolean;
  // tagged logger for debug messages (defaults to FILE tag)
  logger?: TaggedLogger;
  // timeout for async reads in milliseconds (default: no timeout)
  timeoutMs?: number;
  // custom timeout error message for async reads
  timeoutMessage?: string;
  // invoke callback when a read/parse operation fails
  onError?: (error: unknown) => void;
}

// handle file operation errors (invoke callback & optionally log)
function handleFileError(
  err: unknown,
  filePath: string,
  operation: string,
  options?: FileOptions
): null {
  options?.onError?.(err);
  if (options?.logOnError) {
    const log = options.logger ?? defaultLog;
    log.debug(
      `Failed to ${operation} ${filePath}: ${extractErrorMessage(err)}`
    );
  }
  return null;
}

// parse JSON content w/ error handling
function parseJsonSafe<T>(
  content: string,
  filePath: string,
  options?: FileOptions
): T | null {
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    return handleFileError(err, filePath, 'parse JSON at', options);
  }
}

// synchronous file operations

// safely read a file synchronously, returning null on any failure
export function readFileSync(
  filePath: string,
  encoding: BufferEncoding = 'utf-8',
  options?: FileOptions
): string | null {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (err) {
    return handleFileError(err, filePath, 'read', options);
  }
}

// safely read & parse a JSON file synchronously
export function readJsonSync<T = unknown>(
  filePath: string,
  options?: FileOptions
): T | null {
  const content = readFileSync(filePath, 'utf-8', options);
  if (content === null) {
    return null;
  }

  return parseJsonSafe<T>(content, filePath, options);
}

// check if a path exists (file or directory)
export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// asynchronous file operations

// safely read a file asynchronously, returning null on any failure
export async function readFileAsync(
  filePath: string,
  encoding: BufferEncoding = 'utf-8',
  options?: FileOptions
): Promise<string | null> {
  try {
    const readPromise = fs.promises.readFile(filePath, encoding);
    const timeoutMs = options?.timeoutMs;

    if (timeoutMs === undefined) {
      return await readPromise;
    }

    const timeoutMessage =
      options?.timeoutMessage ??
      `Read timed out after ${timeoutMs}ms: ${filePath}`;
    return await raceTimeout(readPromise, {
      timeoutMs,
      errorMessage: timeoutMessage,
    });
  } catch (err) {
    return handleFileError(err, filePath, 'read', options);
  }
}

// safely read & parse a JSON file asynchronously
export async function readJsonAsync<T = unknown>(
  filePath: string,
  options?: FileOptions
): Promise<T | null> {
  const content = await readFileAsync(filePath, 'utf-8', options);
  if (content === null) {
    return null;
  }

  return parseJsonSafe<T>(content, filePath, options);
}

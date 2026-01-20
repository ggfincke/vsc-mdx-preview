// packages/extension/utils/file-utils.ts
// Centralized file I/O utilities with consistent error handling
//
// Error handling strategy:
// - All functions return null/undefined on failure (never throw)
// - Optional debug logging via options parameter
// - Consistent error message format for troubleshooting

import * as fs from 'fs';
import { debug as logDebug } from '../logging';

// options for file operations
export interface FileOptions {
  // enable debug logging on failure (default: false)
  logOnError?: boolean;
  // log tag for debug messages (e.g., '[FRAMEWORK]')
  logTag?: string;
}

// ============================================================================
// SYNCHRONOUS FILE OPERATIONS
// ============================================================================

// safely read a file synchronously, returning null on any failure
export function readFileSync(
  filePath: string,
  encoding: BufferEncoding = 'utf-8',
  options?: FileOptions
): string | null {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (err) {
    if (options?.logOnError) {
      const tag = options.logTag ?? '[FILE]';
      const message = err instanceof Error ? err.message : String(err);
      logDebug(`${tag} Failed to read ${filePath}: ${message}`);
    }
    return null;
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

  try {
    return JSON.parse(content) as T;
  } catch (err) {
    if (options?.logOnError) {
      const tag = options.logTag ?? '[FILE]';
      const message = err instanceof Error ? err.message : String(err);
      logDebug(`${tag} Failed to parse JSON at ${filePath}: ${message}`);
    }
    return null;
  }
}

// check if a path exists (file or directory)
export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// check if a path exists & is a regular file (not a directory)
export function fileExistsAsFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

// check if a path exists & is a directory
export function directoryExists(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// ============================================================================
// ASYNCHRONOUS FILE OPERATIONS
// ============================================================================

// safely read a file asynchronously, returning null on any failure
export async function readFileAsync(
  filePath: string,
  encoding: BufferEncoding = 'utf-8',
  options?: FileOptions
): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, encoding);
  } catch (err) {
    if (options?.logOnError) {
      const tag = options.logTag ?? '[FILE]';
      const message = err instanceof Error ? err.message : String(err);
      logDebug(`${tag} Failed to read ${filePath}: ${message}`);
    }
    return null;
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

  try {
    return JSON.parse(content) as T;
  } catch (err) {
    if (options?.logOnError) {
      const tag = options.logTag ?? '[FILE]';
      const message = err instanceof Error ? err.message : String(err);
      logDebug(`${tag} Failed to parse JSON at ${filePath}: ${message}`);
    }
    return null;
  }
}

// check if a file exists & is readable asynchronously w/ optional size validation
export async function statFileAsync(
  filePath: string,
  maxBytes?: number
): Promise<{ exists: true; isFile: boolean; size: number } | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (maxBytes !== undefined && stat.size > maxBytes) {
      return null;
    }
    return {
      exists: true,
      isFile: stat.isFile(),
      size: stat.size,
    };
  } catch {
    return null;
  }
}

// read file content only if it meets size requirements
export async function readFileIfUnderSize(
  filePath: string,
  maxBytes: number,
  options?: FileOptions
): Promise<string | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > maxBytes) {
      if (options?.logOnError) {
        const tag = options.logTag ?? '[FILE]';
        logDebug(
          `${tag} Skipping large file: ${filePath} (${stat.size} > ${maxBytes})`
        );
      }
      return null;
    }
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (err) {
    if (options?.logOnError) {
      const tag = options.logTag ?? '[FILE]';
      const message = err instanceof Error ? err.message : String(err);
      logDebug(`${tag} Failed to read ${filePath}: ${message}`);
    }
    return null;
  }
}

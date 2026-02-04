// packages/extension/tailwind/FileScanValidator.ts
// file validation utilities for Tailwind scanning - handle file size, token, & parallel read validation

import * as fs from 'fs';
import { extractErrorMessage, LogTags, Semaphore } from '@mdx-preview/shared';
import { debug } from '../logging';
import { CLASS_TOKEN_RE, TAILWIND_FILE_READ_LIMIT } from './constants';

const readSemaphore = new Semaphore(TAILWIND_FILE_READ_LIMIT);

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

export interface FileReadResult {
  fsPath: string;
  content: string | null;
}

// validate files before scanning for Tailwind classes
// consolidates file I/O & validation logic for testability
export class FileScanValidator {
  // validate file size before reading
  async validateFileSize(
    fsPath: string,
    maxBytes: number
  ): Promise<FileValidationResult> {
    try {
      const stat = await fs.promises.stat(fsPath);
      if (stat.size > maxBytes) {
        return {
          valid: false,
          reason: `File size ${stat.size} exceeds limit ${maxBytes}`,
        };
      }
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        reason: `Cannot stat file: ${extractErrorMessage(err)}`,
      };
    }
  }

  // validate file extension against allowed list
  validateExtension(
    fsPath: string,
    allowedExts: string[]
  ): FileValidationResult {
    const ext = fsPath.slice(fsPath.lastIndexOf('.'));
    if (!allowedExts.includes(ext)) {
      return {
        valid: false,
        reason: `Extension ${ext} not in allowed list: ${allowedExts.join(', ')}`,
      };
    }
    return { valid: true };
  }

  // validate a Tailwind class token
  validateClassToken(token: string): boolean {
    return CLASS_TOKEN_RE.test(token);
  }

  // read file content w/ size validation
  async readFileIfValid(
    fsPath: string,
    maxBytes: number
  ): Promise<string | null> {
    try {
      const stat = await fs.promises.stat(fsPath);
      if (stat.size > maxBytes) {
        debug(`[${LogTags.TAILWIND}] Skipping large file: ${fsPath}`);
        return null;
      }
      return await fs.promises.readFile(fsPath, 'utf-8');
    } catch (err) {
      debug(
        `[${LogTags.TAILWIND}] Skipping unreadable file: ${fsPath} (${extractErrorMessage(err)})`
      );
      return null;
    }
  }

  // read multiple files in parallel w/ validation
  // skip files that are too large or unreadable
  async readValidFiles(
    fsPaths: string[],
    maxBytes: number
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // read files w/ concurrency limit to prevent I/O exhaustion
    const readPromises = fsPaths.map(
      async (fsPath): Promise<FileReadResult> => {
        await readSemaphore.acquire();
        try {
          const content = await this.readFileIfValid(fsPath, maxBytes);
          return { fsPath, content };
        } finally {
          readSemaphore.release();
        }
      }
    );

    const fileResults = await Promise.all(readPromises);

    for (const { fsPath, content } of fileResults) {
      if (content !== null) {
        results.set(fsPath, content);
      }
    }

    return results;
  }
}

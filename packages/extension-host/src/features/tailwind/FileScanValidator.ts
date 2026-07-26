// packages/extension-host/src/features/tailwind/FileScanValidator.ts
// file validation utilities for Tailwind scanning - handle file size, token, & parallel read validation

import * as fs from 'fs';
import { LogTags } from '@mdx-preview/contracts';
import { Semaphore, extractErrorMessage } from '@mdx-preview/runtime-utils';
import { createTaggedLogger } from '../../shared/logging/logger';
import { TAILWIND_FILE_READ_LIMIT } from './constants';
import { readFileAsync } from '../../shared/utils/file-utils';

const log = createTaggedLogger(LogTags.TAILWIND);
const readSemaphore = new Semaphore(TAILWIND_FILE_READ_LIMIT);

export interface FileReadResult {
  fsPath: string;
  content: string | null;
}

export interface FileStampResult {
  fsPath: string;
  stamp: string | null;
}

// validate files before scanning for Tailwind classes
// consolidate file I/O & validation logic for testability
export class FileScanValidator {
  // stat files before reads so dependency scans can reuse unchanged results
  async getFileStampIfValid(
    fsPath: string,
    maxBytes: number
  ): Promise<string | null> {
    try {
      const stat = await fs.promises.stat(fsPath);
      if (stat.size > maxBytes) {
        log.debug(`Skipping large file: ${fsPath}`);
        return null;
      }
      return `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
    } catch (err) {
      log.debug(
        `Skipping unreadable file: ${fsPath} (${extractErrorMessage(err)})`
      );
      return null;
    }
  }

  // read file content w/ size validation
  async readFileIfValid(
    fsPath: string,
    maxBytes: number
  ): Promise<string | null> {
    try {
      const stat = await fs.promises.stat(fsPath);
      if (stat.size > maxBytes) {
        log.debug(`Skipping large file: ${fsPath}`);
        return null;
      }

      let readError: unknown;
      const content = await readFileAsync(fsPath, 'utf-8', {
        onError: (error) => {
          readError = error;
        },
      });

      if (content === null) {
        const reason =
          readError !== undefined
            ? extractErrorMessage(readError)
            : 'Unknown read error';
        log.debug(`Skipping unreadable file: ${fsPath} (${reason})`);
      }

      return content;
    } catch (err) {
      log.debug(
        `Skipping unreadable file: ${fsPath} (${extractErrorMessage(err)})`
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

  // stat multiple files in parallel w/ the same I/O bound as full reads
  async getValidFileStamps(
    fsPaths: string[],
    maxBytes: number
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const stampPromises = fsPaths.map(
      async (fsPath): Promise<FileStampResult> => {
        await readSemaphore.acquire();
        try {
          const stamp = await this.getFileStampIfValid(fsPath, maxBytes);
          return { fsPath, stamp };
        } finally {
          readSemaphore.release();
        }
      }
    );

    const stampResults = await Promise.all(stampPromises);
    for (const { fsPath, stamp } of stampResults) {
      if (stamp !== null) {
        results.set(fsPath, stamp);
      }
    }
    return results;
  }
}

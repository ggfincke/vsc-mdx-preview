// packages/extension-host/src/features/tailwind/scanning/DependencyScanner.ts
// scan imported dependencies for Tailwind classes

import * as path from 'path';
import { ContentHashCache, Semaphore } from '@mdx-preview/runtime-utils';
import { getUnifiedResolver } from '../../module-runtime/resolution/UnifiedResolver';
import type { ResolutionContext, TextExtractor } from '../../types';
import { FileScanValidator } from '../FileScanValidator';
import { TAILWIND_DEPENDENCY_RESOLUTION_LIMIT } from '../constants';

const resolveSemaphore = new Semaphore(TAILWIND_DEPENDENCY_RESOLUTION_LIMIT);

// resolve & scan imported dependency files for Tailwind classes
export class DependencyScanner {
  private readonly validator = new FileScanValidator();
  private readonly resolver = getUnifiedResolver();

  // scan dependency files for Tailwind classes
  // optionally use scanCache to avoid re-scanning unchanged files
  async scanDependencies(
    entryFilePath: string,
    imports: string[],
    maxFileSizeBytes: number,
    extractFromText: TextExtractor,
    providedContext?: ResolutionContext,
    scanCache?: ContentHashCache<string[]>
  ): Promise<{ classes: Set<string>; scannedFiles: string[] }> {
    const classSet = new Set<string>();
    const scannedFiles: string[] = [];

    // resolve all imports to absolute paths
    const resolved = await this.resolveDependencies(
      entryFilePath,
      imports,
      providedContext
    );

    // check cheap file stamps before reading unchanged dependency contents
    const fileStamps = await this.validator.getValidFileStamps(
      resolved,
      maxFileSizeBytes
    );
    const filesToRead: string[] = [];
    for (const [fsPath, stamp] of fileStamps) {
      const cached = scanCache
        ? scanCache.getIfHashMatches(fsPath, stamp)
        : null;
      if (cached !== null) {
        for (const cls of cached) {
          classSet.add(cls);
        }
        scannedFiles.push(fsPath);
      } else {
        filesToRead.push(fsPath);
      }
    }

    const fileContents = await this.validator.readValidFiles(
      filesToRead,
      maxFileSizeBytes
    );
    for (const [fsPath, content] of fileContents) {
      const fileClassSet = new Set<string>();
      extractFromText(content, fileClassSet);

      for (const cls of fileClassSet) {
        classSet.add(cls);
      }

      const stamp = fileStamps.get(fsPath);
      if (stamp) {
        scanCache?.setWithHash(fsPath, stamp, Array.from(fileClassSet));
      }
      scannedFiles.push(fsPath);
    }

    return { classes: classSet, scannedFiles };
  }

  // resolve import specifiers to absolute file paths
  private async resolveDependencies(
    entryFilePath: string,
    imports: string[],
    providedContext?: ResolutionContext
  ): Promise<string[]> {
    const entryDir = path.dirname(entryFilePath);

    // use provided context if available & always ensure baseDir is set to entry directory
    const context: ResolutionContext = providedContext
      ? { ...providedContext, baseDir: entryDir }
      : { baseDir: entryDir };

    // filter to resolvable relative imports
    const toResolve = imports.filter((specifier) => {
      return (
        this.resolver.shouldResolve(specifier) &&
        this.resolver.isRelativeImport(specifier)
      );
    });

    // resolve w/ concurrency limit to prevent resource exhaustion
    const resolutionPromises = toResolve.map(async (specifier) => {
      await resolveSemaphore.acquire();
      try {
        const result = await this.resolver.resolveAsync(
          specifier,
          context,
          'dependency'
        );
        return result && !result.isBuiltInShim ? result.fsPath : null;
      } finally {
        resolveSemaphore.release();
      }
    });

    const results = await Promise.all(resolutionPromises);
    return results.filter((target): target is string => target !== null);
  }
}

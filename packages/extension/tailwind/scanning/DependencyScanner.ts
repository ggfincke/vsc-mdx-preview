// packages/extension/tailwind/scanning/DependencyScanner.ts
// scan imported dependencies for Tailwind classes

import * as path from 'path';
import { getUnifiedResolver } from '../../module-system/resolver/UnifiedResolver';
import type { ResolutionContext, TextExtractor } from '../../types';
import { Semaphore } from '../../utils/Semaphore';
import { FileScanValidator } from '../FileScanValidator';
import { TailwindScanCache, computeContentHash } from '../TailwindScanCache';
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
    scanCache?: TailwindScanCache
  ): Promise<{ classes: Set<string>; scannedFiles: string[] }> {
    const classSet = new Set<string>();
    const scannedFiles: string[] = [];

    // resolve all imports to absolute paths
    const resolved = await this.resolveDependencies(
      entryFilePath,
      imports,
      providedContext
    );

    // read all dependency files in parallel using FileScanValidator
    const fileContents = await this.validator.readValidFiles(
      resolved,
      maxFileSizeBytes
    );

    // extract classes from each file w/ optional caching
    for (const [fsPath, content] of fileContents) {
      const hash = computeContentHash(content);

      // check cache first
      const cached = scanCache?.get(fsPath, hash);
      if (cached) {
        // use cached classes
        for (const cls of cached) {
          classSet.add(cls);
        }
      } else {
        // extract classes & cache the result
        const fileClassSet = new Set<string>();
        extractFromText(content, fileClassSet);

        // add to main class set
        for (const cls of fileClassSet) {
          classSet.add(cls);
        }

        // store in cache
        scanCache?.set(fsPath, hash, Array.from(fileClassSet));
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

    // use provided context if available, otherwise fall back to minimal context
    // always ensure baseDir is set to the entry directory for relative resolution
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

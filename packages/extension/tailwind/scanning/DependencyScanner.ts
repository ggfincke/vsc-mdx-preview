// packages/extension/tailwind/scanning/DependencyScanner.ts
// scan imported dependencies for Tailwind classes

import * as path from 'path';
import {
  getUnifiedResolver,
  type ResolutionContext,
} from '../../module-system/resolver/UnifiedResolver';
import { FileScanValidator } from '../FileScanValidator';
import type { TextExtractor } from './types';

// resolves & scans imported dependency files for Tailwind classes
export class DependencyScanner {
  private readonly validator = new FileScanValidator();
  private readonly resolver = getUnifiedResolver();

  // scan dependency files for Tailwind classes
  async scanDependencies(
    entryFilePath: string,
    imports: string[],
    maxFileSizeBytes: number,
    extractFromText: TextExtractor,
    providedContext?: ResolutionContext
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

    // extract classes from each file
    for (const [fsPath, content] of fileContents) {
      extractFromText(content, classSet);
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

    // filter to resolvable relative imports & resolve in parallel
    const resolutionPromises = imports
      .filter((specifier) => {
        // must be resolvable & relative
        return (
          this.resolver.shouldResolve(specifier) &&
          this.resolver.isRelativeImport(specifier)
        );
      })
      .map(async (specifier) => {
        const result = await this.resolver.resolveAsync(
          specifier,
          context,
          'dependency'
        );
        return result && !result.isBuiltInShim ? result.fsPath : null;
      });

    const results = await Promise.all(resolutionPromises);
    return results.filter((target): target is string => target !== null);
  }
}

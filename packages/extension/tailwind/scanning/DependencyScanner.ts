// packages/extension/tailwind/scanning/DependencyScanner.ts
// scan imported dependencies for Tailwind classes

import * as path from 'path';
import {
  getUnifiedResolver,
  type ResolutionContext,
} from '../../module-fetcher/UnifiedResolver';
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
    extractFromText: TextExtractor
  ): Promise<{ classes: Set<string>; scannedFiles: string[] }> {
    const classSet = new Set<string>();
    const scannedFiles: string[] = [];

    // Resolve all imports to absolute paths
    const resolved = await this.resolveDependencies(entryFilePath, imports);

    // Read all dependency files in parallel using FileScanValidator
    const fileContents = await this.validator.readValidFiles(
      resolved,
      maxFileSizeBytes
    );

    // Extract classes from each file
    for (const [fsPath, content] of fileContents) {
      extractFromText(content, classSet);
      scannedFiles.push(fsPath);
    }

    return { classes: classSet, scannedFiles };
  }

  // resolve import specifiers to absolute file paths
  private async resolveDependencies(
    entryFilePath: string,
    imports: string[]
  ): Promise<string[]> {
    const entryDir = path.dirname(entryFilePath);

    // Build resolution context (simple for Tailwind - just needs baseDir)
    const context: ResolutionContext = {
      baseDir: entryDir,
    };

    // Filter to resolvable relative imports and resolve in parallel
    const resolutionPromises = imports
      .filter((specifier) => {
        // Must be resolvable and relative
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

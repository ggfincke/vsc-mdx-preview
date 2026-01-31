// packages/extension/tailwind/TailwindScanner.ts
// coordinator for extracting Tailwind class candidates from MDX/JSX content

import { PatternScanner, ContentScanner, DependencyScanner } from './scanning';
import { TailwindScanCache } from './TailwindScanCache';
import type { ResolutionContext } from '../types';

export interface TailwindScanOptions {
  includeDependencies: boolean;
  entryFilePath?: string;
  entryFileDependencies?: string[];
  maxFileSizeBytes?: number;
  // resolution context for proper import resolution (parity w/ module-system)
  resolutionContext?: ResolutionContext;
  // optional scan cache for incremental scanning
  scanCache?: TailwindScanCache;
}

export interface TailwindScanResult {
  classList: string[];
  scannedFiles: string[];
}

// extracts Tailwind class candidates from MDX/JSX/TSX content using pattern & content scanners
export class TailwindScanner {
  private readonly patternScanner = new PatternScanner();
  private readonly contentScanner = new ContentScanner();
  private readonly dependencyScanner = new DependencyScanner();

  // scan text & optionally dependencies for Tailwind classes
  async scan(
    text: string,
    options: TailwindScanOptions
  ): Promise<TailwindScanResult> {
    const classSet = new Set<string>();
    const scannedFiles: string[] = [];

    // extract from main text (synchronous - no I/O)
    this.extractFromText(text, classSet);

    // optionally scan dependency files
    if (
      options.includeDependencies &&
      options.entryFilePath &&
      options.entryFileDependencies &&
      options.entryFileDependencies.length > 0
    ) {
      const sizeLimit = options.maxFileSizeBytes ?? 1024 * 1024;

      // pass through scan cache for incremental scanning
      const result = await this.dependencyScanner.scanDependencies(
        options.entryFilePath,
        options.entryFileDependencies,
        sizeLimit,
        (t, cs) => this.extractFromText(t, cs),
        options.resolutionContext,
        options.scanCache
      );

      result.classes.forEach((c) => classSet.add(c));
      scannedFiles.push(...result.scannedFiles);
    }

    return {
      classList: Array.from(classSet).sort(),
      scannedFiles: scannedFiles.sort(),
    };
  }

  // extract Tailwind classes from text content using all scanning strategies
  private extractFromText(text: string, classSet: Set<string>): void {
    // pattern-based extraction (static patterns)
    this.patternScanner.extractStaticAttributes(text, classSet);
    this.patternScanner.extractApplyDirectives(text, classSet);
    this.patternScanner.extractLayerClasses(text, classSet, (t, p, o, c) =>
      this.contentScanner.extractBracedExpressions(t, p, o, c)
    );

    // content-based extraction (dynamic patterns)
    this.contentScanner.extractDynamicExpressions(text, classSet);
    this.contentScanner.extractUtilityFunctions(text, classSet);
    this.contentScanner.extractCvaPatterns(text, classSet);
    this.contentScanner.extractArrayJoinPatterns(text, classSet);
  }
}

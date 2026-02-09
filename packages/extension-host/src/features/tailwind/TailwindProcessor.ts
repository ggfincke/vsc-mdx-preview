// packages/extension/tailwind/TailwindProcessor.ts
// orchestrate Tailwind detection, scanning, compilation, & caching

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { createTaggedLogger } from '../../shared/logging/logger';
import { SingletonService } from '../../app/services/SingletonService';
import { getErrorReporter, getFrameworkDetector } from '../../app/services';
import type { ResolutionContext } from '../types';
import { ErrorContext, ErrorSeverity } from '../../shared/errors';
import { TailwindDetector } from './TailwindDetector';
import { TailwindScanner } from './TailwindScanner';
import { TailwindCompiler, type TailwindVersion } from './TailwindCompiler';
import {
  MIN_SUPPORTED_TAILWIND_VERSION,
  MAX_KNOWN_TAILWIND_VERSION,
  TAILWIND_CACHE_SCHEMA_VERSION,
  CACHE_DEFAULT_MAX_ENTRIES,
  SCAN_CACHE_DEFAULT_MAX_ENTRIES,
  CACHE_DEFAULT_TTL_MS,
} from './constants';
import {
  ContentHashCache,
  LRUCache,
  LogTags,
  normalizeError,
} from '@mdx-preview/shared';

const log = createTaggedLogger(LogTags.TAILWIND);

// re-export canonical type definitions from types/
export type { TailwindProcessOptions, TailwindProcessResult } from '../types';

import type { TailwindProcessOptions, TailwindProcessResult } from '../types';

export class TailwindProcessor extends SingletonService<TailwindProcessor> {
  protected static override instance: TailwindProcessor | undefined;
  protected readonly logTag = LogTags.TAILWIND;

  private detector = new TailwindDetector();
  private scanner = new TailwindScanner();
  private cache: LRUCache<string, string>;
  private scanCache: ContentHashCache<string[]>;
  private compiler = new TailwindCompiler();

  protected constructor() {
    super();
    this.cache = new LRUCache<string, string>({
      maxEntries: CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: CACHE_DEFAULT_TTL_MS,
    });
    this.scanCache = new ContentHashCache<string[]>({
      maxEntries: SCAN_CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: CACHE_DEFAULT_TTL_MS,
    });
  }

  async process(
    options: TailwindProcessOptions
  ): Promise<TailwindProcessResult> {
    const {
      preview,
      mdxText,
      entryFilePath,
      entryFileDependencies,
      trustState,
      tailwindConfig,
    } = options;

    // update cache settings from unified config
    this.cache.updateSettings({
      maxEntries: tailwindConfig.cacheMaxEntries,
      ttlMs: tailwindConfig.cacheTtlSeconds * 1000,
    });

    log.debug('Process start');

    if (!trustState.canExecute) {
      return { css: '', watchFiles: [], enabled: false };
    }

    if (tailwindConfig.enabled === 'disabled') {
      return { css: '', watchFiles: [], enabled: false };
    }

    const workspaceRoot = this.detector.resolveWorkspaceRoot({
      docUri: preview.doc.uri,
      entryDir: preview.entryFsDirectory,
    });
    const configPathOverride = tailwindConfig.configPath;
    const configPath = this.detector.resolveConfigPath({
      entryDir: preview.entryFsDirectory,
      workspaceRoot,
      configOverride: configPathOverride,
      configDir: preview.mdxPreviewConfig?.configDir,
    });
    const entryCssPath = await this.detector.resolveEntryCssPath({
      workspaceRoot,
      entryDir: preview.entryFsDirectory,
      maxCssFilesToSearch: tailwindConfig.maxCssFilesToSearch,
    });

    if (tailwindConfig.enabled === 'auto' && !configPath && !entryCssPath) {
      return { css: '', watchFiles: [], enabled: false };
    }

    const versionInfo =
      this.detector.getWorkspaceTailwindVersion(workspaceRoot);

    // guard for unsupported versions (v1, v2)
    if (
      versionInfo.major !== null &&
      versionInfo.major < MIN_SUPPORTED_TAILWIND_VERSION
    ) {
      log.debug(
        `Unsupported Tailwind version ${versionInfo.version} (v${versionInfo.major}). Minimum supported: v${MIN_SUPPORTED_TAILWIND_VERSION}`
      );
      return { css: '', watchFiles: [], enabled: false };
    }

    // warn about unknown future versions (may need updates)
    if (
      versionInfo.major !== null &&
      versionInfo.major > MAX_KNOWN_TAILWIND_VERSION
    ) {
      log.warn(
        `Tailwind v${versionInfo.major} detected. This extension supports v4. ` +
          `v${versionInfo.major} will be treated as v4, which may cause issues.`
      );
    }

    const tailwindVersion: TailwindVersion = 'v4';

    const baseDir = configPath
      ? path.dirname(configPath)
      : (workspaceRoot ?? preview.entryFsDirectory);

    // build ResolutionContext for Tailwind scanning (parity w/ module-system)
    const frameworkDetector = getFrameworkDetector();
    const frameworkInfo = frameworkDetector.getFramework(preview.doc.uri);
    const shimsEnabled = frameworkDetector.areShimsEnabled(preview.doc.uri);

    const resolutionContext: ResolutionContext = {
      baseDir: preview.entryFsDirectory ?? path.dirname(entryFilePath),
      tsConfig: preview.typescriptConfiguration,
      framework: frameworkInfo.framework,
      workspaceRoot: workspaceRoot ?? preview.entryFsDirectory ?? undefined,
      shimsEnabled,
    };

    const scanStart = performance.now();
    const scanResult = await this.scanner.scan(mdxText, {
      includeDependencies: true,
      entryFilePath,
      entryFileDependencies,
      maxFileSizeBytes: tailwindConfig.maxFileSizeBytes,
      resolutionContext,
      // use incremental scan cache
      scanCache: this.scanCache,
    });
    const scanDuration = performance.now() - scanStart;
    log.debug(
      `Scanned ${scanResult.scannedFiles.length + 1} file(s) in ${Math.round(
        scanDuration
      )}ms`
    );

    const content = scanResult.classList.join(' ');
    const cacheKey = await this.buildCacheKey(
      tailwindVersion,
      content,
      configPath,
      entryCssPath
    );

    // LRUCache.get() returns string | null (null = expired or missing)
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return {
        css: cached,
        watchFiles: this.buildWatchFiles(configPath, entryCssPath),
        enabled: true,
      };
    }

    const compileStart = performance.now();
    try {
      log.debug('Compiling CSS...');
      const css = await this.compiler.compile({
        tailwindVersion,
        configPath,
        entryCssPath,
        content,
        baseDir,
      });
      const compileDuration = performance.now() - compileStart;
      log.debug(
        `Compiled in ${Math.round(compileDuration)}ms (classes=${scanResult.classList.length})`
      );
      this.cache.set(cacheKey, css);
      return {
        css,
        watchFiles: this.buildWatchFiles(configPath, entryCssPath),
        enabled: true,
      };
    } catch (error: unknown) {
      // Tailwind errors are non-blocking
      getErrorReporter().report(normalizeError(error), {
        context: ErrorContext.Tailwind,
        severity: ErrorSeverity.Warning,
        showNotification: false,
        metadata: { operation: 'compilation' },
      });
      return { css: '', watchFiles: [], enabled: false };
    }
  }

  // invalidate the Tailwind version cache
  // handle config change, re-detect version
  invalidateVersionCache(workspaceRoot?: string | null): void {
    this.detector.invalidateVersionCache(workspaceRoot);
  }

  // invalidate Tailwind detection caches for config & entry CSS paths
  invalidateDetectionCaches(changedPaths: string[]): void {
    this.detector.invalidateDetectionCaches(changedPaths);
  }

  // custom cleanup - clear caches
  protected override onDispose(): void {
    this.cache.clear();
    log.debug('Cache cleared');
    this.scanCache.clear();
    this.detector.invalidateVersionCache();
  }

  // invalidate scan cache for a specific file or clear all
  // useful when DependencyWatcher detects external file changes
  invalidateScanCache(fsPath?: string): void {
    if (fsPath) {
      if (this.scanCache.delete(fsPath)) {
        log.debug(`Invalidated scan cache for ${fsPath}`);
      }
    } else {
      this.scanCache.clear();
      log.debug('Scan cache cleared');
    }
  }

  private buildWatchFiles(
    configPath: string | null,
    entryCssPath: string | null
  ): string[] {
    const files = new Set<string>();
    if (configPath) {
      files.add(configPath);
    }
    if (entryCssPath) {
      files.add(entryCssPath);
    }
    // sort for deterministic ordering (consistent w/ TailwindScanner)
    return Array.from(files).sort();
  }

  private async buildCacheKey(
    version: TailwindVersion,
    content: string,
    configPath: string | null,
    entryCssPath: string | null
  ): Promise<string> {
    const [configStamp, entryStamp] = await Promise.all([
      this.getFileStamp(configPath),
      this.getFileStamp(entryCssPath),
    ]);

    const payload = JSON.stringify({
      schemaVersion: TAILWIND_CACHE_SCHEMA_VERSION,
      version,
      content,
      configPath,
      configStamp,
      entryCssPath,
      entryStamp,
    });

    return crypto.createHash('sha1').update(payload).digest('hex');
  }

  private async getFileStamp(filePath: string | null): Promise<string> {
    if (!filePath) {
      return '';
    }

    try {
      const stat = await fs.promises.stat(filePath);
      return `${stat.mtimeMs}`;
    } catch (error: unknown) {
      // return unique error stamp to bust cache on transient errors
      // this prevents stale cache hits when file is temporarily unreadable
      log.debug(`Failed to stat file ${filePath}: ${error}`);
      return `error:${Date.now()}`;
    }
  }
}

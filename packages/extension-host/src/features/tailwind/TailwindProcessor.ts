// packages/extension-host/src/features/tailwind/TailwindProcessor.ts
// orchestrate Tailwind detection, scanning, compilation, & caching

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { createTaggedLogger } from '../../shared/logging/logger';
import { SingletonService } from '../../app/services/SingletonService';
import { getErrorReporter } from '../../app/services';
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
} from './constants';
import { LogTags, STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import {
  ContentHashCache,
  LRUCache,
  normalizeError,
} from '@mdx-preview/runtime-utils';
import { buildResolutionContext } from '../module-runtime/resolution/resolution-context';

const log = createTaggedLogger(LogTags.TAILWIND);

// re-export canonical type definitions from types/
export type {
  TailwindRuntimeProfile,
  TailwindProfileOptions,
  TailwindProcessOptions,
  TailwindProcessResult,
} from './types/processor';

import type {
  TailwindProfileOptions,
  TailwindProcessOptions,
  TailwindProcessResult,
} from './types/processor';
import type { TailwindProfileDetectionResult } from './types/detector';

export class TailwindProcessor extends SingletonService<TailwindProcessor> {
  protected static override instance: TailwindProcessor | undefined;
  protected readonly logTag = LogTags.TAILWIND;

  private detector = new TailwindDetector();
  private scanner = new TailwindScanner();
  private cache: LRUCache<string, string>;
  private scanCache: ContentHashCache<string[]>;
  private browserInputCache: LRUCache<string, string>;
  private compiler = new TailwindCompiler();

  protected constructor() {
    super();
    this.cache = new LRUCache<string, string>({
      maxEntries: CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: STANDARD_CACHE_TTL_MS,
    });
    this.scanCache = new ContentHashCache<string[]>({
      maxEntries: SCAN_CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: STANDARD_CACHE_TTL_MS,
    });
    this.browserInputCache = new LRUCache<string, string>({
      maxEntries: CACHE_DEFAULT_MAX_ENTRIES,
      ttlMs: STANDARD_CACHE_TTL_MS,
    });
  }

  async process(
    options: TailwindProcessOptions
  ): Promise<TailwindProcessResult> {
    const { preview, mdxText, trustState, tailwindConfig, profileHint } =
      options;

    // update cache settings from unified config
    this.cache.updateSettings({
      maxEntries: tailwindConfig.cacheMaxEntries,
      ttlMs: tailwindConfig.cacheTtlSeconds * 1000,
    });

    log.debug('Process start');

    if (!trustState.canExecute) {
      return this.disabledResult(
        'Trusted Mode is required for Tailwind processing'
      );
    }

    if (tailwindConfig.enabled === 'disabled') {
      return this.disabledResult('Tailwind is disabled by configuration');
    }

    const profile =
      profileHint ??
      (await this.detectProfile({
        preview,
        mdxText,
        tailwindConfig,
      }));

    const { profile: activeProfile, reason, entryCssPath } = profile;

    if (tailwindConfig.enabled === 'auto' && !profile.hasTailwindInput) {
      return this.disabledResult(
        'Tailwind auto mode found no Tailwind CSS input'
      );
    }

    if (activeProfile === 'browser') {
      return this.processBrowserProfile(reason, entryCssPath, profile);
    }

    return this.processAdvancedProfile(profile, options);
  }

  // build the shared disabled result shape (reason varies per gate)
  private disabledResult(profileReason: string): TailwindProcessResult {
    return {
      profile: 'disabled',
      profileReason,
      css: '',
      watchFiles: [],
      enabled: false,
    };
  }

  // handle browser profile: build input CSS from entry file & inline styles
  private async processBrowserProfile(
    reason: string,
    entryCssPath: string | null,
    profile: TailwindProfileDetectionResult
  ): Promise<TailwindProcessResult> {
    const browserInputCss = await this.buildBrowserInputCss(
      entryCssPath,
      profile.inlineTailwindStyles
    );
    return {
      profile: 'browser',
      profileReason: reason,
      css: browserInputCss,
      watchFiles: this.buildWatchFiles(null, entryCssPath),
      enabled: true,
    };
  }

  // handle advanced profile: version check, scan, cache, & compile
  private async processAdvancedProfile(
    profile: TailwindProfileDetectionResult,
    options: TailwindProcessOptions
  ): Promise<TailwindProcessResult> {
    const {
      preview,
      mdxText,
      entryFilePath,
      entryFileDependencies,
      tailwindConfig,
    } = options;

    const { reason, workspaceRoot, configPath, entryCssPath } = profile;

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
      return this.disabledResult(
        `Unsupported Tailwind version ${versionInfo.version ?? 'unknown'}`
      );
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

    const resolutionContext = buildResolutionContext({
      baseDir: preview.entryFsDirectory ?? path.dirname(entryFilePath),
      tsConfig: preview.typescriptConfiguration,
      documentUri: preview.doc.uri,
      entryFsDirectory: preview.entryFsDirectory,
      workspaceRoot: workspaceRoot ?? preview.entryFsDirectory ?? undefined,
    });

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
        profile: 'advanced',
        profileReason: reason,
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
        profile: 'advanced',
        profileReason: reason,
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
      return this.disabledResult('Tailwind advanced compilation failed');
    }
  }

  // capability routing for Tailwind browser vs advanced profiles
  async detectProfile(
    options: TailwindProfileOptions
  ): Promise<TailwindProfileDetectionResult> {
    const { preview, mdxText, tailwindConfig } = options;

    const workspaceRoot = this.detector.resolveWorkspaceRoot({
      docUri: preview.doc.uri,
      entryDir: preview.entryFsDirectory,
    });

    return this.detector.detectProfile({
      workspaceRoot,
      entryDir: preview.entryFsDirectory,
      configOverride: tailwindConfig.configPath,
      configDir: preview.mdxPreviewConfig?.configDir,
      maxCssFilesToSearch: tailwindConfig.maxCssFilesToSearch,
      mdxText,
    });
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

  // clear every Tailwind result & detection cache
  clearCaches(): void {
    this.cache.clear();
    this.scanCache.clear();
    this.browserInputCache.clear();
    this.detector.clearCaches();
    log.debug('Caches cleared');
  }

  // custom cleanup - clear caches
  protected override onDispose(): void {
    this.clearCaches();
    this.detector.dispose();
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

  // build Tailwind browser runtime input CSS from entry file + inline style blocks
  private async buildBrowserInputCss(
    entryCssPath: string | null,
    inlineTailwindStyles: string[]
  ): Promise<string> {
    const normalizedInlineStyles = inlineTailwindStyles
      .map((style) => style.trim())
      .filter(Boolean);
    const entryStamp = await this.getFileStamp(entryCssPath);
    const inlineHash = crypto
      .createHash('sha1')
      .update(JSON.stringify(normalizedInlineStyles))
      .digest('hex');
    const cacheKey = JSON.stringify({
      entryCssPath,
      entryStamp,
      inlineHash,
    });
    const cached = this.browserInputCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const segments: string[] = [];

    if (entryCssPath) {
      try {
        const entryCss = await fs.promises.readFile(entryCssPath, 'utf8');
        segments.push(entryCss.trim());
      } catch (error: unknown) {
        log.warn(`Failed to read Tailwind entry CSS at ${entryCssPath}`, error);
      }
    }

    segments.push(...normalizedInlineStyles);

    let inputCss: string;
    if (segments.length === 0) {
      inputCss = '@import "tailwindcss";';
    } else {
      inputCss = segments.join('\n\n');
    }
    this.browserInputCache.set(cacheKey, inputCss);
    return inputCss;
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

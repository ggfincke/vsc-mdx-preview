// packages/extension/tailwind/TailwindProcessor.ts
// orchestrate Tailwind detection, scanning, compilation, & caching
//
// error handling strategy:
// - this is the orchestrator - catches all errors from child modules
// - Compilation failures are logged at ERROR level (user-facing) via logError()
// - Returns safe defaults { css: '', watchFiles: [], enabled: false } on failure
// - File stat errors in cache key building are silently handled (non-critical)

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import { debug, error as logError, warn } from '../logging';
import { TailwindDetector } from './TailwindDetector';
import { TailwindScanner } from './TailwindScanner';
import { TailwindCache } from './TailwindCache';
import { TailwindCompiler, type TailwindVersion } from './TailwindCompiler';
import {
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_MAX_CSS_FILES_TO_SEARCH,
  PROCESSOR_CACHE_DEFAULT_MAX_ENTRIES,
  PROCESSOR_CACHE_DEFAULT_TTL_SECONDS,
  MIN_SUPPORTED_TAILWIND_VERSION,
  MAX_KNOWN_TAILWIND_VERSION,
} from './constants';
import type { Preview } from '../preview/preview-manager';
import type { TrustState } from '@mdx-preview/shared-types';

interface TailwindSettings {
  maxFileSizeBytes: number;
  maxCssFilesToSearch: number;
  cacheMaxEntries: number;
  cacheTtlSeconds: number;
}

function getTailwindSettings(): TailwindSettings {
  const config = vscode.workspace.getConfiguration('mdx-preview.tailwind');
  return {
    maxFileSizeBytes: config.get<number>(
      'maxFileSizeBytes',
      DEFAULT_MAX_FILE_SIZE_BYTES
    ),
    maxCssFilesToSearch: config.get<number>(
      'maxCssFilesToSearch',
      DEFAULT_MAX_CSS_FILES_TO_SEARCH
    ),
    cacheMaxEntries: config.get<number>(
      'cacheMaxEntries',
      PROCESSOR_CACHE_DEFAULT_MAX_ENTRIES
    ),
    cacheTtlSeconds: config.get<number>(
      'cacheTtlSeconds',
      PROCESSOR_CACHE_DEFAULT_TTL_SECONDS
    ),
  };
}

export interface TailwindProcessOptions {
  preview: Preview;
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
}

export interface TailwindProcessResult {
  css: string;
  watchFiles: string[];
  enabled: boolean;
}

export class TailwindProcessor {
  private static instance: TailwindProcessor;
  private detector = new TailwindDetector();
  private scanner = new TailwindScanner();
  private cache = new TailwindCache();
  private compiler = new TailwindCompiler();

  static getInstance(): TailwindProcessor {
    if (!TailwindProcessor.instance) {
      TailwindProcessor.instance = new TailwindProcessor();
    }
    return TailwindProcessor.instance;
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
    } = options;

    const configTailwind = preview.mdxPreviewConfig?.config.tailwind;
    const enabledSetting =
      configTailwind?.enabled ?? preview.configuration.tailwindEnabled;

    // read settings & update cache if changed
    const settings = getTailwindSettings();
    this.cache.updateSettings({
      maxEntries: settings.cacheMaxEntries,
      ttlMs: settings.cacheTtlSeconds * 1000,
    });

    debug('[TAILWIND] Process start');

    if (!trustState.canExecute) {
      return { css: '', watchFiles: [], enabled: false };
    }

    if (enabledSetting === 'disabled') {
      return { css: '', watchFiles: [], enabled: false };
    }

    const workspaceRoot = this.detector.resolveWorkspaceRoot({
      docUri: preview.doc.uri,
      entryDir: preview.entryFsDirectory,
    });
    const configPath = this.detector.resolveConfigPath({
      entryDir: preview.entryFsDirectory,
      workspaceRoot,
      configOverride: configTailwind?.configPath,
      configDir: preview.mdxPreviewConfig?.configDir,
    });
    const entryCssPath = await this.detector.resolveEntryCssPath({
      workspaceRoot,
      entryDir: preview.entryFsDirectory,
      maxCssFilesToSearch: settings.maxCssFilesToSearch,
    });

    if (enabledSetting === 'auto' && !configPath && !entryCssPath) {
      return { css: '', watchFiles: [], enabled: false };
    }

    const versionInfo =
      this.detector.getWorkspaceTailwindVersion(workspaceRoot);

    // Guard for unsupported versions (v1, v2)
    if (
      versionInfo.major !== null &&
      versionInfo.major < MIN_SUPPORTED_TAILWIND_VERSION
    ) {
      debug(
        `[TAILWIND] Unsupported Tailwind version ${versionInfo.version} (v${versionInfo.major}). Minimum supported: v${MIN_SUPPORTED_TAILWIND_VERSION}`
      );
      return { css: '', watchFiles: [], enabled: false };
    }

    // Warn about unknown future versions (may need updates)
    if (
      versionInfo.major !== null &&
      versionInfo.major > MAX_KNOWN_TAILWIND_VERSION
    ) {
      warn(
        `[TAILWIND] Tailwind v${versionInfo.major} detected. This extension supports v3 and v4. ` +
          `v${versionInfo.major} will be treated as v4, which may cause issues.`
      );
    }

    // TODO: Add explicit v5 handling when released
    const tailwindVersion: TailwindVersion =
      versionInfo.major === 3 ? 'v3' : 'v4';
    const baseDir = configPath
      ? path.dirname(configPath)
      : (workspaceRoot ?? preview.entryFsDirectory);

    const scanStart = performance.now();
    const scanResult = await this.scanner.scan(mdxText, {
      includeDependencies: true,
      entryFilePath,
      entryFileDependencies,
      maxFileSizeBytes: settings.maxFileSizeBytes,
    });
    const scanDuration = performance.now() - scanStart;
    debug(
      `[TAILWIND] Scanned ${scanResult.scannedFiles.length + 1} file(s) in ${Math.round(
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

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        css: cached,
        watchFiles: this.buildWatchFiles(configPath, entryCssPath),
        enabled: true,
      };
    }

    const compileStart = performance.now();
    try {
      debug('[TAILWIND] Compiling CSS...');
      const css = await this.compiler.compile({
        tailwindVersion,
        configPath,
        entryCssPath,
        content,
        workspaceTailwindPath:
          versionInfo.major === 3 ? versionInfo.modulePath : undefined,
        baseDir,
      });
      const compileDuration = performance.now() - compileStart;
      debug(
        `[TAILWIND] Compiled in ${Math.round(compileDuration)}ms (classes=${scanResult.classList.length})`
      );
      this.cache.set(cacheKey, css);
      return {
        css,
        watchFiles: this.buildWatchFiles(configPath, entryCssPath),
        enabled: true,
      };
    } catch (error) {
      logError('Tailwind compilation failed', error);
      return { css: '', watchFiles: [], enabled: false };
    }
  }

  // invalidate the Tailwind version cache
  // called when config files change to ensure version is re-detected
  invalidateVersionCache(workspaceRoot?: string | null): void {
    this.detector.invalidateVersionCache(workspaceRoot);
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
    } catch (error) {
      // Return unique error stamp to bust cache on transient errors
      // This prevents stale cache hits when file is temporarily unreadable
      debug(`[TAILWIND] Failed to stat file ${filePath}: ${error}`);
      return `error:${Date.now()}`;
    }
  }
}

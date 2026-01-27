// packages/extension/tailwind/TailwindProcessor.ts
// orchestrate Tailwind detection, scanning, compilation, & caching

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import { debug, warn } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { getErrorReporter, getFrameworkDetector } from '../services';
import type { ResolutionContext } from '../module-system/resolver/UnifiedResolver';
import { ErrorContext, ErrorSeverity } from '../errors';
import { TailwindDetector } from './TailwindDetector';
import { TailwindScanner } from './TailwindScanner';
import { TailwindCache } from './TailwindCache';
import { TailwindScanCache } from './TailwindScanCache';
import { TailwindCompiler, type TailwindVersion } from './TailwindCompiler';
import {
  MIN_SUPPORTED_TAILWIND_VERSION,
  MAX_KNOWN_TAILWIND_VERSION,
} from './constants';
import type { Preview } from '../preview/preview-manager';
import { normalizeError, type TrustState } from '@mdx-preview/shared';
import type { TailwindConfig } from '../config/EffectivePreviewConfig';

export interface TailwindProcessOptions {
  preview: Preview;
  mdxText: string;
  entryFilePath: string;
  entryFileDependencies: string[];
  trustState: TrustState;
  tailwindConfig: TailwindConfig;
}

export interface TailwindProcessResult {
  css: string;
  watchFiles: string[];
  enabled: boolean;
}

export class TailwindProcessor extends SingletonService<TailwindProcessor> {
  protected static override instance: TailwindProcessor | undefined;
  protected readonly logTag = 'TAILWIND';

  private detector = new TailwindDetector();
  private scanner = new TailwindScanner();
  private cache = new TailwindCache();
  private scanCache = new TailwindScanCache();
  private compiler = new TailwindCompiler();

  // tracks workspaces where v3 deprecation warning has been shown (once per session)
  private v3WarningShown = new Set<string>();

  protected constructor() {
    super();
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

    debug('[TAILWIND] Process start');

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
      debug(
        `[TAILWIND] Unsupported Tailwind version ${versionInfo.version} (v${versionInfo.major}). Minimum supported: v${MIN_SUPPORTED_TAILWIND_VERSION}`
      );
      return { css: '', watchFiles: [], enabled: false };
    }

    // warn about unknown future versions (may need updates)
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

    // warn about v3 deprecation (once per workspace per session)
    if (tailwindVersion === 'v3') {
      this.warnTailwindV3Deprecation(workspaceRoot);
    }

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
      scanCache: this.scanCache, // use incremental scan cache
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

    // TailwindCache.get() returns string | null (null = expired or missing)
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
      // Tailwind errors are non-blocking
      getErrorReporter().report(normalizeError(error), {
          context: ErrorContext.Tailwind,
          severity: ErrorSeverity.Warning,
          showNotification: false,
          metadata: { operation: 'compilation' },
        }
      );
      return { css: '', watchFiles: [], enabled: false };
    }
  }

  // invalidate the Tailwind version cache
  // called when config files change to ensure version is re-detected
  invalidateVersionCache(workspaceRoot?: string | null): void {
    this.detector.invalidateVersionCache(workspaceRoot);
  }

  // custom cleanup - clear caches
  protected override onDispose(): void {
    this.cache.clear();
    this.scanCache.clear();
    this.detector.invalidateVersionCache();
  }

  // invalidate scan cache for a specific file or clear all
  // useful when DependencyWatcher detects external file changes
  invalidateScanCache(fsPath?: string): void {
    if (fsPath) {
      this.scanCache.invalidate(fsPath);
    } else {
      this.scanCache.clear();
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
      // return unique error stamp to bust cache on transient errors
      // this prevents stale cache hits when file is temporarily unreadable
      debug(`[TAILWIND] Failed to stat file ${filePath}: ${error}`);
      return `error:${Date.now()}`;
    }
  }

  // warn users about Tailwind v3 deprecation (once per workspace per session)
  private warnTailwindV3Deprecation(workspaceRoot: string | null): void {
    const key = workspaceRoot ?? 'default';
    if (this.v3WarningShown.has(key)) {
      return;
    }
    this.v3WarningShown.add(key);

    warn(
      '[TAILWIND] Tailwind CSS v3 detected. MDX Preview is optimized for Tailwind v4. ' +
        'Consider upgrading for improved performance and features.'
    );

    // show user-facing notification w/ action button
    vscode.window
      .showWarningMessage(
        'MDX Preview: Tailwind CSS v3 detected. Consider upgrading to v4 for best results.',
        'Upgrade Guide'
      )
      .then((selection) => {
        if (selection === 'Upgrade Guide') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://tailwindcss.com/docs/upgrade-guide')
          );
        }
      });
  }
}

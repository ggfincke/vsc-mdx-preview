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
import type { ResolutionContext } from '../module-fetcher/UnifiedResolver';
import { ErrorContext, ErrorSeverity } from '../errors';
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
import type { TailwindConfig } from '../config/EffectivePreviewConfig';

// Legacy settings interface for backward compatibility
interface TailwindSettings {
  maxFileSizeBytes: number;
  maxCssFilesToSearch: number;
  cacheMaxEntries: number;
  cacheTtlSeconds: number;
}

// Legacy function - prefer using EffectivePreviewConfig.tailwind
// @deprecated Use effectiveConfig.tailwind instead
function getTailwindSettings(): TailwindSettings {
  // eslint-disable-next-line local/no-direct-vscode-config -- deprecated function, to be removed
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
  /** Unified effective config - preferred over legacy settings */
  tailwindConfig?: TailwindConfig;
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
  private compiler = new TailwindCompiler();

  /** Tracks workspaces where v3 deprecation warning has been shown (once per session) */
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

    // Use unified config if provided, otherwise fall back to legacy settings
    const settings = tailwindConfig ?? getTailwindSettings();
    const configTailwind = preview.mdxPreviewConfig?.config.tailwind;

    // Determine enabled setting: tailwindConfig > config file > preview config
    const enabledSetting = tailwindConfig
      ? tailwindConfig.enabled
      : (configTailwind?.enabled ?? preview.configuration.tailwindEnabled);

    // Update cache settings
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
    // Use configPath from tailwindConfig if provided, otherwise from config file
    const configPathOverride =
      tailwindConfig?.configPath ?? configTailwind?.configPath;
    const configPath = this.detector.resolveConfigPath({
      entryDir: preview.entryFsDirectory,
      workspaceRoot,
      configOverride: configPathOverride,
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

    // Warn about v3 deprecation (once per workspace per session)
    if (tailwindVersion === 'v3') {
      this.warnTailwindV3Deprecation(workspaceRoot);
    }

    const baseDir = configPath
      ? path.dirname(configPath)
      : (workspaceRoot ?? preview.entryFsDirectory);

    // Build ResolutionContext for Tailwind scanning (parity with module-fetcher)
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
      maxFileSizeBytes: settings.maxFileSizeBytes,
      resolutionContext,
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
      getErrorReporter().report(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: ErrorContext.Tailwind,
          severity: ErrorSeverity.Warning,
          showNotification: false, // Tailwind errors are non-blocking
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
    this.detector.invalidateVersionCache();
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

  /**
   * Warn users about Tailwind v3 deprecation.
   * Shows once per workspace per session to avoid notification spam.
   */
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

    // Show user-facing notification with action button
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

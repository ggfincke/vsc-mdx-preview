// packages/extension-host/src/features/tailwind/TailwindDetector.ts
// detect Tailwind config, entry CSS, & workspace version w/ silent failures on missing files

import * as path from 'path';
import * as vscode from 'vscode';
import { LogTags, STANDARD_CACHE_TTL_MS } from '@mdx-preview/contracts';
import { LRUCache, extractErrorMessage } from '@mdx-preview/runtime-utils';
import { createTaggedLogger } from '../../shared/logging/logger';
import { getNodeResolver } from '../module-runtime/resolution/resolver-factory';
import {
  pathExists,
  readFileAsync,
  readJsonSync,
} from '../../shared/utils/file-utils';
import { toAbsolutePath } from '../../shared/utils/path-utils';
import { findUp } from '../../shared/utils/find-up';
import { PathCache } from '../../shared/utils/cache';
import {
  DETECTOR_CONFIG_CACHE_MAX_ENTRIES,
  DETECTOR_ENTRY_CSS_CACHE_MAX_ENTRIES,
  DETECTOR_VERSION_CACHE_MAX_ENTRIES,
} from './constants';

const log = createTaggedLogger(LogTags.TAILWIND);

const CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
];

const TAILWIND_IMPORT_RE = /@import\s+['"]tailwindcss(?:\/[^'"]+)?['"]/;
const TAILWIND_DIRECTIVE_RE = /@tailwind\s+(base|components|utilities)\b/;
const TAILWIND_PLUGIN_DIRECTIVE_RE = /@plugin\b/;

// css content qualifies as a Tailwind entry if it imports or directs Tailwind
function isTailwindEntryCss(content: string | null): boolean {
  return (
    !!content &&
    (TAILWIND_IMPORT_RE.test(content) || TAILWIND_DIRECTIVE_RE.test(content))
  );
}
const INLINE_TAILWIND_STYLE_RE =
  /<style\b[^>]*\btype\s*=\s*["']text\/tailwindcss["'][^>]*>([\s\S]*?)<\/style>/gi;

// common CSS file locations to check before doing a full workspace scan
// ordered by likelihood based on typical project structures
const COMMON_CSS_LOCATIONS = [
  // Root level (most common)
  'tailwind.css',
  'globals.css',
  'global.css',
  'app.css',
  'main.css',
  'styles.css',
  'style.css',
  'index.css',
  // src directory
  'src/tailwind.css',
  'src/globals.css',
  'src/global.css',
  'src/app.css',
  'src/styles.css',
  'src/index.css',
  // styles directory
  'styles/tailwind.css',
  'styles/globals.css',
  'styles/main.css',
  'styles/index.css',
  // app directory (Next.js 13+)
  'app/globals.css',
  'app/global.css',
  'app/layout.css',
  // assets directory
  'assets/css/tailwind.css',
  'assets/css/main.css',
  'assets/styles.css',
  // css directory
  'css/tailwind.css',
  'css/main.css',
  'css/styles.css',
];

// re-export canonical type definitions from types/
export type {
  TailwindVersionInfo,
  TailwindProfile,
  TailwindProfileDetectionResult,
  ResolveWorkspaceRootOptions,
  ResolveConfigPathOptions,
  ResolveEntryCssPathOptions,
  DetectTailwindProfileOptions,
} from '../types';

import type {
  TailwindVersionInfo,
  TailwindProfileDetectionResult,
  ResolveWorkspaceRootOptions,
  ResolveConfigPathOptions,
  ResolveEntryCssPathOptions,
  DetectTailwindProfileOptions,
} from '../types';

export class TailwindDetector {
  // use LRUCache to prevent unbounded memory growth in large workspaces
  private configCache = new PathCache<string | null>({
    logTag: LogTags.TAILWIND,
    maxEntries: DETECTOR_CONFIG_CACHE_MAX_ENTRIES,
  });
  private entryCssCache = new PathCache<string | null>({
    logTag: LogTags.TAILWIND,
    maxEntries: DETECTOR_ENTRY_CSS_CACHE_MAX_ENTRIES,
  });
  // version cache has both TTL & max entries
  private versionCache = new LRUCache<string, TailwindVersionInfo>({
    maxEntries: DETECTOR_VERSION_CACHE_MAX_ENTRIES,
    ttlMs: STANDARD_CACHE_TTL_MS,
  });

  resolveWorkspaceRoot(options: ResolveWorkspaceRootOptions): string | null {
    const { docUri, entryDir } = options;

    if (docUri.scheme === 'file') {
      const folder = vscode.workspace.getWorkspaceFolder(docUri);
      if (folder) {
        return folder.uri.fsPath;
      }
    }

    if (entryDir) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        for (const folder of folders) {
          if (entryDir.startsWith(folder.uri.fsPath)) {
            return folder.uri.fsPath;
          }
        }
      }
    }

    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  }

  resolveConfigPath(options: ResolveConfigPathOptions): string | null {
    const { entryDir, workspaceRoot, configOverride, configDir } = options;

    if (configOverride) {
      const baseDir = configDir ?? entryDir ?? workspaceRoot;
      if (!baseDir) {
        return null;
      }
      const resolved = toAbsolutePath(configOverride, baseDir);
      return pathExists(resolved) ? resolved : null;
    }

    const cacheKey = `${workspaceRoot ?? ''}::${entryDir ?? ''}`;
    const cachedConfig = this.configCache.get(cacheKey);
    if (cachedConfig !== undefined) {
      if (cachedConfig && pathExists(cachedConfig)) {
        return cachedConfig;
      }
      this.configCache.delete(cacheKey);
    }

    const searchStart = entryDir ?? workspaceRoot;
    if (!searchStart) {
      this.configCache.set(cacheKey, null);
      return null;
    }

    // use shared find-up utility
    const found = findUp({
      filename: CONFIG_FILES,
      startDir: searchStart,
      stopAt: workspaceRoot ?? undefined,
    });

    this.configCache.set(cacheKey, found ?? null);
    return found ?? null;
  }

  async resolveEntryCssPath(
    options: ResolveEntryCssPathOptions
  ): Promise<string | null> {
    const { workspaceRoot, entryDir, maxCssFilesToSearch = 500 } = options;

    if (!workspaceRoot) {
      return null;
    }

    const cacheKey = `${workspaceRoot}::${entryDir ?? ''}`;
    const cachedEntryCss = this.entryCssCache.get(cacheKey);
    if (cachedEntryCss !== undefined) {
      if (cachedEntryCss && pathExists(cachedEntryCss)) {
        return cachedEntryCss;
      }
      this.entryCssCache.delete(cacheKey);
    }

    // first, check common locations for faster detection
    const commonResult = await this.findEntryCssInCommonLocations(
      workspaceRoot,
      entryDir
    );
    if (commonResult) {
      this.entryCssCache.set(cacheKey, commonResult);
      log.debug(`Found entry CSS in common location: ${commonResult}`);
      return commonResult;
    }

    // fall back to full workspace scan if not found in common locations
    log.debug('Entry CSS not in common locations, scanning workspace...');
    const include = new vscode.RelativePattern(workspaceRoot, '**/*.css');
    const exclude = '**/node_modules/**';
    const candidates = await vscode.workspace.findFiles(
      include,
      exclude,
      maxCssFilesToSearch
    );

    for (const uri of candidates) {
      const content = await readFileAsync(uri.fsPath);
      if (isTailwindEntryCss(content)) {
        this.entryCssCache.set(cacheKey, uri.fsPath);
        return uri.fsPath;
      }
    }

    this.entryCssCache.set(cacheKey, null);
    return null;
  }

  // route workspace to browser or advanced Tailwind profile
  async detectProfile(
    options: DetectTailwindProfileOptions
  ): Promise<TailwindProfileDetectionResult> {
    const {
      workspaceRoot,
      entryDir,
      configOverride,
      configDir,
      maxCssFilesToSearch = 500,
      mdxText,
    } = options;

    const configPath = this.resolveConfigPath({
      entryDir,
      workspaceRoot,
      configOverride,
      configDir,
    });
    const entryCssPath = await this.resolveEntryCssPath({
      workspaceRoot,
      entryDir,
      maxCssFilesToSearch,
    });

    const inlineTailwindStyles = this.extractInlineTailwindStyles(mdxText);

    if (configPath) {
      return {
        profile: 'advanced',
        reason: `tailwind.config.* detected at ${configPath}`,
        workspaceRoot,
        configPath,
        entryCssPath,
        hasTailwindInput: true,
        inlineTailwindStyles,
      };
    }

    // @plugin checks only matter w/o a config file, so compute them here
    let entryCssHasPluginDirective = false;
    if (entryCssPath) {
      const entryCss = await readFileAsync(entryCssPath);
      entryCssHasPluginDirective =
        entryCss !== null && TAILWIND_PLUGIN_DIRECTIVE_RE.test(entryCss);
    }
    const hasInlinePluginDirective = inlineTailwindStyles.some((styleText) =>
      TAILWIND_PLUGIN_DIRECTIVE_RE.test(styleText)
    );

    const pluginReason = entryCssHasPluginDirective
      ? `@plugin directive detected in ${entryCssPath}`
      : hasInlinePluginDirective
        ? '@plugin directive detected in inline style[type="text/tailwindcss"] block'
        : null;

    if (pluginReason) {
      return {
        profile: 'advanced',
        reason: pluginReason,
        workspaceRoot,
        configPath,
        entryCssPath,
        hasTailwindInput: true,
        inlineTailwindStyles,
      };
    }

    return {
      profile: 'browser',
      reason: 'No tailwind.config.* or plugin directives detected',
      workspaceRoot,
      configPath,
      entryCssPath,
      hasTailwindInput:
        Boolean(entryCssPath) || inlineTailwindStyles.length > 0,
      inlineTailwindStyles,
    };
  }

  // collect inline Tailwind style blocks from the current MDX source
  extractInlineTailwindStyles(mdxText?: string): string[] {
    if (!mdxText) {
      return [];
    }

    const styles: string[] = [];
    const matcher = new RegExp(INLINE_TAILWIND_STYLE_RE.source, 'gi');
    for (const match of mdxText.matchAll(matcher)) {
      const cssText = match[1]?.trim();
      if (cssText) {
        styles.push(cssText);
      }
    }
    return styles;
  }

  // invalidate cached config & entry CSS results for changed paths
  invalidateDetectionCaches(changedPaths: string[]): void {
    if (changedPaths.length === 0) {
      return;
    }

    const pathSet = new Set(changedPaths);

    this.configCache.invalidateWhere((_, value) => {
      return value !== null && pathSet.has(value);
    });

    this.entryCssCache.invalidateWhere((_, value) => {
      return value !== null && pathSet.has(value);
    });
  }

  // check common CSS file locations for Tailwind entry CSS
  // this is faster than scanning the entire workspace
  private async findEntryCssInCommonLocations(
    workspaceRoot: string,
    entryDir: string | null
  ): Promise<string | null> {
    // build list of directories to check (entryDir first if different from workspace)
    const dirsToCheck: string[] = [];
    if (entryDir && entryDir !== workspaceRoot) {
      dirsToCheck.push(entryDir);
    }
    dirsToCheck.push(workspaceRoot);

    for (const baseDir of dirsToCheck) {
      // check all common locations in parallel for this directory
      const checks = COMMON_CSS_LOCATIONS.map(async (relativePath) => {
        const fullPath = path.join(baseDir, relativePath);
        const content = await readFileAsync(fullPath);
        return isTailwindEntryCss(content) ? fullPath : null;
      });

      const results = await Promise.all(checks);
      const found = results.find((result) => result !== null);
      if (found) {
        return found;
      }
    }

    return null;
  }

  // get the installed Tailwind CSS version for a workspace (cached w/ 5-minute TTL)
  // LRUCache handles TTL automatically, so we just get/set directly
  getWorkspaceTailwindVersion(
    workspaceRoot: string | null
  ): TailwindVersionInfo {
    const cacheKey = workspaceRoot ?? 'default';

    // check cache (LRUCache handles TTL expiration automatically)
    const cached = this.versionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const resolver = getNodeResolver();
    let resolved: string | false | undefined;
    try {
      if (workspaceRoot) {
        resolved = resolver.resolveSync(
          {},
          workspaceRoot,
          'tailwindcss/package.json'
        );
      }
    } catch (err) {
      log.debug(
        `Failed to resolve tailwindcss in ${workspaceRoot}: ${extractErrorMessage(err)}`
      );
      resolved = undefined;
    }

    if (!resolved) {
      log.debug(`Tailwind CSS not found in workspace: ${workspaceRoot}`);
      const info: TailwindVersionInfo = { version: null, major: null };
      this.versionCache.set(cacheKey, info);
      return info;
    }

    const pkg = readJsonSync<{ version?: string }>(resolved, {
      logger: log,
      logOnError: true,
    });

    if (!pkg) {
      const info: TailwindVersionInfo = { version: null, major: null };
      this.versionCache.set(cacheKey, info);
      return info;
    }

    const version = pkg.version ?? null;
    const major = version ? Number(version.split('.')[0]) : null;
    const info: TailwindVersionInfo = {
      version,
      major: Number.isNaN(major) ? null : major,
      modulePath: path.dirname(resolved),
    };
    this.versionCache.set(cacheKey, info);
    log.debug(`Workspace Tailwind version: ${version ?? 'unknown'}`);
    return info;
  }

  // invalidate version cache for a specific workspace or all workspaces
  // handle config changes
  invalidateVersionCache(workspaceRoot?: string | null): void {
    if (workspaceRoot !== undefined) {
      const cacheKey = workspaceRoot ?? 'default';
      this.versionCache.delete(cacheKey);
      log.debug(`Version cache invalidated for: ${cacheKey}`);
    } else {
      this.versionCache.clear();
      log.debug('All version caches invalidated');
    }
  }
}

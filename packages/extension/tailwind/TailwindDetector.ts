// packages/extension/tailwind/TailwindDetector.ts
// detect Tailwind config, entry CSS, & workspace version
//
// error handling strategy:
// - discovery module - silent failures are expected & intentional
// - file not found = Tailwind not configured (returns null, no error)
// - all file I/O wrapped in try-catch, returns null/undefined on failure
// - debug logging added for troubleshooting detection issues

import * as path from 'path';
import * as vscode from 'vscode';
import { extractErrorMessage } from '@mdx-preview/shared';
import { debug } from '../logging';
import { getNodeResolver } from '../module-system/resolver/resolver-factory';
import { VERSION_CACHE_TTL_MS } from './constants';
import { pathExists, readFileAsync, readJsonSync } from '../utils/file-utils';
import { toAbsolutePath } from '../utils/path-utils';

const CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
];

const TAILWIND_IMPORT_RE = /@import\s+['"]tailwindcss(?:\/[^'"]+)?['"]/;
const TAILWIND_DIRECTIVE_RE = /@tailwind\s+(base|components|utilities)\b/;

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

export interface TailwindVersionInfo {
  version: string | null;
  major: number | null;
  modulePath?: string;
}

interface VersionCacheEntry {
  info: TailwindVersionInfo;
  expiresAt: number;
}

export interface TailwindDetectionResult {
  workspaceRoot: string | null;
  configPath: string | null;
  entryCssPath: string | null;
}

export interface ResolveWorkspaceRootOptions {
  docUri: vscode.Uri;
  entryDir?: string | null;
}

export interface ResolveConfigPathOptions {
  entryDir?: string | null;
  workspaceRoot?: string | null;
  configOverride?: string;
  configDir?: string;
}

export interface ResolveEntryCssPathOptions {
  workspaceRoot: string | null;
  entryDir: string | null;
  maxCssFilesToSearch?: number;
}

export class TailwindDetector {
  private configCache = new Map<string, string | null>();
  private entryCssCache = new Map<string, string | null>();
  private versionCache = new Map<string, VersionCacheEntry>();

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
    if (this.configCache.has(cacheKey)) {
      const cached = this.configCache.get(cacheKey) ?? null;
      if (cached && pathExists(cached)) {
        return cached;
      }
      this.configCache.delete(cacheKey);
    }

    const searchStart = entryDir ?? workspaceRoot;
    if (!searchStart) {
      this.configCache.set(cacheKey, null);
      return null;
    }

    let currentDir = searchStart;
    while (currentDir) {
      for (const fileName of CONFIG_FILES) {
        const candidate = path.join(currentDir, fileName);
        if (pathExists(candidate)) {
          this.configCache.set(cacheKey, candidate);
          return candidate;
        }
      }

      if (workspaceRoot && currentDir === workspaceRoot) {
        break;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    this.configCache.set(cacheKey, null);
    return null;
  }

  async resolveEntryCssPath(
    options: ResolveEntryCssPathOptions
  ): Promise<string | null> {
    const { workspaceRoot, entryDir, maxCssFilesToSearch = 500 } = options;

    if (!workspaceRoot) {
      return null;
    }

    const cacheKey = `${workspaceRoot}::${entryDir ?? ''}`;
    if (this.entryCssCache.has(cacheKey)) {
      const cached = this.entryCssCache.get(cacheKey) ?? null;
      if (cached && pathExists(cached)) {
        return cached;
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
      debug(`[TAILWIND] Found entry CSS in common location: ${commonResult}`);
      return commonResult;
    }

    // fall back to full workspace scan if not found in common locations
    debug(
      '[TAILWIND] Entry CSS not in common locations, scanning workspace...'
    );
    const include = new vscode.RelativePattern(workspaceRoot, '**/*.css');
    const exclude = '**/node_modules/**';
    const candidates = await vscode.workspace.findFiles(
      include,
      exclude,
      maxCssFilesToSearch
    );

    for (const uri of candidates) {
      const content = await readFileAsync(uri.fsPath);
      if (
        content &&
        (TAILWIND_IMPORT_RE.test(content) ||
          TAILWIND_DIRECTIVE_RE.test(content))
      ) {
        this.entryCssCache.set(cacheKey, uri.fsPath);
        return uri.fsPath;
      }
    }

    this.entryCssCache.set(cacheKey, null);
    return null;
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
        if (
          content &&
          (TAILWIND_IMPORT_RE.test(content) ||
            TAILWIND_DIRECTIVE_RE.test(content))
        ) {
          return fullPath;
        }
        return null;
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
  getWorkspaceTailwindVersion(
    workspaceRoot: string | null
  ): TailwindVersionInfo {
    const cacheKey = workspaceRoot ?? 'default';

    // check cache w/ TTL
    const cached = this.versionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.info;
    }

    // cache miss or expired - delete stale entry
    if (cached) {
      this.versionCache.delete(cacheKey);
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
      debug(
        `[TAILWIND] Failed to resolve tailwindcss in ${workspaceRoot}: ${extractErrorMessage(err)}`
      );
      resolved = undefined;
    }

    if (!resolved) {
      debug(`[TAILWIND] Tailwind CSS not found in workspace: ${workspaceRoot}`);
      const info: TailwindVersionInfo = { version: null, major: null };
      this.versionCache.set(cacheKey, {
        info,
        expiresAt: Date.now() + VERSION_CACHE_TTL_MS,
      });
      return info;
    }

    const pkg = readJsonSync<{ version?: string }>(resolved, {
      logTag: '[TAILWIND]',
      logOnError: true,
    });

    if (!pkg) {
      const info: TailwindVersionInfo = { version: null, major: null };
      this.versionCache.set(cacheKey, {
        info,
        expiresAt: Date.now() + VERSION_CACHE_TTL_MS,
      });
      return info;
    }

    const version = pkg.version ?? null;
    const major = version ? Number(version.split('.')[0]) : null;
    const info: TailwindVersionInfo = {
      version,
      major: Number.isNaN(major) ? null : major,
      modulePath: path.dirname(resolved),
    };
    this.versionCache.set(cacheKey, {
      info,
      expiresAt: Date.now() + VERSION_CACHE_TTL_MS,
    });
    debug(`[TAILWIND] Workspace Tailwind version: ${version ?? 'unknown'}`);
    return info;
  }

  // invalidate version cache for a specific workspace or all workspaces
  // called when TailwindConfigWatcher detects changes
  invalidateVersionCache(workspaceRoot?: string | null): void {
    if (workspaceRoot !== undefined) {
      const cacheKey = workspaceRoot ?? 'default';
      this.versionCache.delete(cacheKey);
      debug(`[TAILWIND] Version cache invalidated for: ${cacheKey}`);
    } else {
      this.versionCache.clear();
      debug('[TAILWIND] All version caches invalidated');
    }
  }
}

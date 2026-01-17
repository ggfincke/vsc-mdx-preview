// packages/extension/nextra/MetaResolver.ts
// Resolve Nextra _meta.json files for page-level settings

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { debug } from '../logging';
import type { NextraPageMeta } from '@mdx-preview/shared-types';

// Cache for resolved meta (cache key -> resolved meta or null)
const metaCache = new Map<string, NextraPageMeta | null>();
// Track file watchers
const metaWatchers = new Map<string, vscode.FileSystemWatcher>();
// Track change callbacks for preview refresh
const changeCallbacks = new Set<(metaPath: string) => void>();

// Raw _meta.json entry structure (simplified for preview-relevant fields)
type MetaEntry =
  | string
  | {
      title?: string;
      type?: 'page' | 'menu' | 'separator';
      display?: 'normal' | 'hidden' | 'children';
      theme?: {
        layout?: 'default' | 'full' | 'raw';
        toc?: boolean;
        sidebar?: boolean;
        breadcrumb?: boolean;
      };
    };

/**
 * Resolve _meta.json settings for a specific MDX file
 * Searches for _meta.json in the document's directory and parent directories
 * up to the workspace root
 */
export function resolveNextraMeta(
  mdxFilePath: string,
  workspaceRoot: string
): NextraPageMeta | null {
  const documentDir = path.dirname(mdxFilePath);
  const pageBaseName = path.basename(mdxFilePath, path.extname(mdxFilePath));

  // Check cache
  const cacheKey = `${documentDir}:${pageBaseName}`;
  if (metaCache.has(cacheKey)) {
    debug(`[NEXTRA-META] Cache hit for ${cacheKey}`);
    return metaCache.get(cacheKey) ?? null;
  }

  // Search for _meta.json upward
  const metaPath = findMetaFile(documentDir, workspaceRoot);
  if (!metaPath) {
    debug(`[NEXTRA-META] No _meta.json found for ${mdxFilePath}`);
    metaCache.set(cacheKey, null);
    return null;
  }

  try {
    debug(`[NEXTRA-META] Found _meta.json at ${metaPath}`);
    const content = fs.readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(content) as Record<string, MetaEntry>;

    // Extract settings for this page
    const pageSettings = extractPageSettings(meta, pageBaseName);

    // Setup watcher for this _meta.json file
    setupMetaWatcher(metaPath, documentDir);

    metaCache.set(cacheKey, pageSettings);
    debug(`[NEXTRA-META] Resolved meta for ${pageBaseName}:`, pageSettings);
    return pageSettings;
  } catch (err) {
    debug(`[NEXTRA-META] Failed to parse ${metaPath}: ${err}`);
    metaCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Find _meta.json by walking up directory tree
 * Stops at workspace root or filesystem root
 */
function findMetaFile(
  startDir: string,
  workspaceRoot: string
): string | undefined {
  let currentDir = startDir;

  while (currentDir && currentDir.startsWith(workspaceRoot)) {
    const metaPath = path.join(currentDir, '_meta.json');
    if (fs.existsSync(metaPath)) {
      return metaPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    } // filesystem root
    currentDir = parentDir;
  }

  return undefined;
}

/**
 * Extract page-specific settings from _meta.json
 * Handles both string entries (title only) and object entries (full config)
 */
function extractPageSettings(
  meta: Record<string, MetaEntry>,
  pageBaseName: string
): NextraPageMeta | null {
  const entry = meta[pageBaseName];
  if (!entry) {
    return null;
  }

  const result: NextraPageMeta = {};

  if (typeof entry === 'string') {
    // Simple string entry is just a title
    result.title = entry;
  } else if (typeof entry === 'object') {
    // Object entry with full settings
    if (entry.title) {
      result.title = entry.title;
    }
    if (entry.theme?.layout) {
      result.layout = entry.theme.layout;
    }
    if (typeof entry.theme?.toc === 'boolean') {
      result.toc = entry.theme.toc;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Setup file watcher for _meta.json changes
 * Invalidates cache and notifies listeners when file changes
 */
function setupMetaWatcher(metaPath: string, documentDir: string): void {
  if (metaWatchers.has(metaPath)) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(metaPath);

  const handleChange = () => {
    debug(`[NEXTRA-META] _meta.json changed: ${metaPath}`);
    // Clear cache entries for this directory
    for (const key of metaCache.keys()) {
      if (key.startsWith(documentDir)) {
        metaCache.delete(key);
      }
    }
    // Notify listeners
    for (const callback of changeCallbacks) {
      callback(metaPath);
    }
  };

  watcher.onDidChange(handleChange);
  watcher.onDidCreate(handleChange);
  watcher.onDidDelete(() => {
    handleChange();
    metaWatchers.delete(metaPath);
    watcher.dispose();
  });

  metaWatchers.set(metaPath, watcher);
}

/**
 * Merge _meta.json settings with frontmatter (frontmatter wins)
 * Use this to combine settings from both sources
 */
export function mergeNextraMeta(
  metaJson: NextraPageMeta | null,
  frontmatter: Partial<NextraPageMeta>
): NextraPageMeta {
  return {
    ...metaJson,
    ...frontmatter, // Frontmatter overrides _meta.json
  };
}

/**
 * Subscribe to _meta.json changes
 * Callback is invoked when any watched _meta.json file changes
 */
export function onMetaChange(
  callback: (metaPath: string) => void
): vscode.Disposable {
  changeCallbacks.add(callback);
  return new vscode.Disposable(() => {
    changeCallbacks.delete(callback);
  });
}

/**
 * Clear the meta cache (for testing or manual refresh)
 */
export function clearMetaCache(): void {
  metaCache.clear();
}

/**
 * Dispose all file watchers
 * Call during extension deactivation
 */
export function disposeMetaWatchers(): void {
  for (const watcher of metaWatchers.values()) {
    watcher.dispose();
  }
  metaWatchers.clear();
  changeCallbacks.clear();
}

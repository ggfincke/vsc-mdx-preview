// packages/extension/nextra/MetaResolver.ts
// resolve Nextra _meta.json files for page-level settings

import * as path from 'path';
import * as vscode from 'vscode';
import { debug } from '../logging';
import type { NextraPageMeta } from '@mdx-preview/shared';
import { readJsonSync, pathExists } from '../utils/file-utils';

// cache for resolved meta (cache key -> resolved meta or null)
const metaCache = new Map<string, NextraPageMeta | null>();
// track file watchers
const metaWatchers = new Map<string, vscode.FileSystemWatcher>();

// raw _meta.json entry structure (simplified for preview-relevant fields)
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

// * resolve _meta.json settings for a specific MDX file
export function resolveNextraMeta(
  mdxFilePath: string,
  workspaceRoot: string
): NextraPageMeta | null {
  const documentDir = path.dirname(mdxFilePath);
  const pageBaseName = path.basename(mdxFilePath, path.extname(mdxFilePath));

  // check cache (use get + undefined check instead of has + get for efficiency)
  const cacheKey = `${documentDir}:${pageBaseName}`;
  const cached = metaCache.get(cacheKey);
  if (cached !== undefined) {
    debug(`[NEXTRA-META] Cache hit for ${cacheKey}`);
    return cached;
  }

  // search for _meta.json upward
  const metaPath = findMetaFile(documentDir, workspaceRoot);
  if (!metaPath) {
    debug(`[NEXTRA-META] No _meta.json found for ${mdxFilePath}`);
    metaCache.set(cacheKey, null);
    return null;
  }

  debug(`[NEXTRA-META] Found _meta.json at ${metaPath}`);
  const meta = readJsonSync<Record<string, MetaEntry>>(metaPath, {
    logTag: '[NEXTRA-META]',
    logOnError: true,
  });

  if (!meta) {
    metaCache.set(cacheKey, null);
    return null;
  }

  // extract settings for this page
  const pageSettings = extractPageSettings(meta, pageBaseName);

  // setup watcher for this _meta.json file
  setupMetaWatcher(metaPath, documentDir);

  metaCache.set(cacheKey, pageSettings);
  debug(`[NEXTRA-META] Resolved meta for ${pageBaseName}:`, pageSettings);
  return pageSettings;
}

// find _meta.json by walking up directory tree
function findMetaFile(
  startDir: string,
  workspaceRoot: string
): string | undefined {
  let currentDir = startDir;

  while (currentDir && currentDir.startsWith(workspaceRoot)) {
    const metaPath = path.join(currentDir, '_meta.json');
    if (pathExists(metaPath)) {
      return metaPath;
    }

    const parentDir = path.dirname(currentDir);
    // filesystem root
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return undefined;
}

// extract page-specific settings from _meta.json
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
    // simple string entry is just a title
    result.title = entry;
  } else if (typeof entry === 'object') {
    // object entry w/ full settings
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

// setup file watcher for _meta.json changes
function setupMetaWatcher(metaPath: string, documentDir: string): void {
  if (metaWatchers.has(metaPath)) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(metaPath);

  const handleChange = () => {
    debug(`[NEXTRA-META] _meta.json changed: ${metaPath}`);
    // clear cache entries for this directory
    for (const key of metaCache.keys()) {
      if (key.startsWith(documentDir)) {
        metaCache.delete(key);
      }
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

// merge _meta.json settings w/ frontmatter (frontmatter wins)
export function mergeNextraMeta(
  metaJson: NextraPageMeta | null,
  frontmatter: Partial<NextraPageMeta>
): NextraPageMeta {
  return {
    ...metaJson,
    // frontmatter overrides _meta.json
    ...frontmatter,
  };
}

// dispose all file watchers (call during extension deactivation)
export function disposeMetaWatchers(): void {
  for (const watcher of metaWatchers.values()) {
    watcher.dispose();
  }
  metaWatchers.clear();
}

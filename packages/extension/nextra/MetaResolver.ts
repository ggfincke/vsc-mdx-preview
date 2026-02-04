// packages/extension/nextra/MetaResolver.ts
// resolve Nextra _meta.json files for page-level settings

import * as path from 'path';
import { debug } from '../logging';
import { LogTags } from '@mdx-preview/shared';
import type { NextraPageMeta } from '@mdx-preview/shared';
import { readJsonSync } from '../utils/file-utils';
import { findUp, createContainmentStopPredicate } from '../utils/find-up';
import { SingletonService } from '../services/SingletonService';
import { PathCache } from '../utils/cache';

// raw _meta.json entry structure (simplified to preview-relevant fields)
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

// * Nextra _meta.json resolver - resolve page-level settings from _meta.json files
export class MetaResolver extends SingletonService<MetaResolver> {
  protected static override instance: MetaResolver | undefined;
  protected readonly logTag = LogTags.NEXTRA_META;

  // cache resolved meta (cache key -> resolved meta or null)
  private metaCache = new PathCache<NextraPageMeta | null>({
    logTag: LogTags.NEXTRA_META,
  });

  protected constructor() {
    super();
  }

  // resolve _meta.json settings from a specific MDX file
  resolveNextraMeta(
    mdxFilePath: string,
    workspaceRoot: string
  ): NextraPageMeta | null {
    const documentDir = path.dirname(mdxFilePath);
    const pageBaseName = path.basename(mdxFilePath, path.extname(mdxFilePath));

    // check cache (use get + undefined check instead of has + get)
    const cacheKey = `${documentDir}:${pageBaseName}`;
    const cached = this.metaCache.get(cacheKey);
    if (cached !== undefined) {
      debug(`[${this.logTag}] Cache hit for ${cacheKey}`);
      return cached;
    }

    // search upward to find _meta.json
    const metaPath = this.findMetaFile(documentDir, workspaceRoot);
    if (!metaPath) {
      debug(`[${this.logTag}] No _meta.json found for ${mdxFilePath}`);
      this.metaCache.set(cacheKey, null);
      return null;
    }

    debug(`[${this.logTag}] Found _meta.json at ${metaPath}`);
    const meta = readJsonSync<Record<string, MetaEntry>>(metaPath, {
      logTag: this.logTag,
      logOnError: true,
    });

    if (!meta) {
      this.metaCache.set(cacheKey, null);
      return null;
    }

    // extract settings from this page
    const pageSettings = this.extractPageSettings(meta, pageBaseName);

    // setup watcher on this _meta.json file
    this.setupMetaWatcher(metaPath, documentDir);

    this.metaCache.set(cacheKey, pageSettings);
    debug(`[${this.logTag}] Resolved meta for ${pageBaseName}:`, pageSettings);
    return pageSettings;
  }

  // merge _meta.json settings w/ frontmatter (frontmatter wins)
  mergeNextraMeta(
    metaJson: NextraPageMeta | null,
    frontmatter: Partial<NextraPageMeta>
  ): NextraPageMeta {
    return {
      ...metaJson,
      // frontmatter overrides _meta.json
      ...frontmatter,
    };
  }

  // find _meta.json by walking up directory tree (uses shared find-up utility)
  private findMetaFile(
    startDir: string,
    workspaceRoot: string
  ): string | undefined {
    return findUp({
      filename: '_meta.json',
      startDir,
      stopAt: createContainmentStopPredicate(workspaceRoot),
    });
  }

  // extract page-specific settings from _meta.json
  private extractPageSettings(
    meta: Record<string, MetaEntry>,
    pageBaseName: string
  ): NextraPageMeta | null {
    const entry = meta[pageBaseName];
    if (!entry) {
      return null;
    }

    const result: NextraPageMeta = {};

    if (typeof entry === 'string') {
      // treat simple string entry as title
      result.title = entry;
    } else if (typeof entry === 'object') {
      // handle object entry w/ full settings
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

  // setup file watcher to detect _meta.json changes
  private setupMetaWatcher(metaPath: string, documentDir: string): void {
    if (this.metaCache.hasWatcher(metaPath)) {
      return;
    }

    const handleChange = () => {
      debug(`[${this.logTag}] _meta.json changed: ${metaPath}`);
      // clear cache entries for this directory
      this.metaCache.invalidateByPrefix(`${documentDir}:`);
    };

    this.metaCache.watchPath(metaPath, {
      onChange: handleChange,
      onCreate: handleChange,
      onDelete: () => {
        handleChange();
        this.metaCache.unwatchPath(metaPath);
      },
    });
  }

  // clean up all file watchers & caches on dispose
  protected override onDispose(): void {
    this.metaCache.dispose();
    debug(`[${this.logTag}] Disposed`);
  }
}

// backward-compatible function exports (delegate to singleton service instance)

// resolve _meta.json settings from a specific MDX file
export function resolveNextraMeta(
  mdxFilePath: string,
  workspaceRoot: string
): NextraPageMeta | null {
  return MetaResolver.getInstance().resolveNextraMeta(
    mdxFilePath,
    workspaceRoot
  );
}

// merge _meta.json settings w/ frontmatter (frontmatter wins)
export function mergeNextraMeta(
  metaJson: NextraPageMeta | null,
  frontmatter: Partial<NextraPageMeta>
): NextraPageMeta {
  return MetaResolver.getInstance().mergeNextraMeta(metaJson, frontmatter);
}

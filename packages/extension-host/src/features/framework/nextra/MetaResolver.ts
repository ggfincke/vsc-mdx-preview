// packages/extension-host/src/features/framework/nextra/MetaResolver.ts
// resolve Nextra _meta.json files for page-level settings

import * as path from 'path';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import type { NextraPageMeta } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.NEXTRA_META);
import { readJsonSync } from '../../../shared/utils/file-utils';
import {
  findUp,
  createContainmentStopPredicate,
} from '../../../shared/utils/find-up';
import { SingletonService } from '../../../app/services/SingletonService';
import { PathCache } from '../../../shared/utils/cache';

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
      log.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // search upward to find _meta.json
    const metaPath = this.findMetaFile(documentDir, workspaceRoot);
    if (!metaPath) {
      log.debug(`No _meta.json found for ${mdxFilePath}`);
      this.metaCache.set(cacheKey, null);
      return null;
    }

    log.debug(`Found _meta.json at ${metaPath}`);
    const meta = readJsonSync<Record<string, MetaEntry>>(metaPath, {
      logger: log,
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
    log.debug(`Resolved meta for ${pageBaseName}:`, pageSettings);
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
      log.debug(`_meta.json changed: ${metaPath}`);
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
    log.debug('Disposed');
  }
}

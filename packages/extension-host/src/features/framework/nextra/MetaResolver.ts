// packages/extension-host/src/features/framework/nextra/MetaResolver.ts
// resolve Nextra _meta.json files for page-level settings

import * as path from 'path';
import { LogTags, type NextraPageMeta } from '@mdx-preview/contracts';
import { LRUCache } from '@mdx-preview/runtime-utils';
import { getPreviewManager } from '../../../app/services';
import { SingletonService } from '../../../app/services/SingletonService';
import { META_CACHE_MAX_ENTRIES } from '../../../shared/constants/runtime';
import { readJsonSync } from '../../../shared/utils/file-utils';
import {
  findUp,
  createContainmentStopPredicate,
} from '../../../shared/utils/find-up';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { PathCache } from '../../../shared/utils/cache';
import {
  isPathWithin,
  normalizePathForComparison,
} from '../../../shared/utils/path-utils';

const log = createTaggedLogger(LogTags.NEXTRA_META);

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

interface MetaWatchTarget {
  path: string;
  cacheKeys: Set<string>;
}

interface TrackedMetaDocument {
  documentPath: string;
  targetKeys: Set<string>;
}

const META_WATCH_PATTERN = '**/_meta.json';

// * Nextra _meta.json resolver - resolve page-level settings from _meta.json files
export class MetaResolver extends SingletonService<MetaResolver> {
  protected static override instance: MetaResolver | undefined;
  protected readonly logTag = LogTags.NEXTRA_META;

  // cache resolved meta (cache key -> resolved meta or null)
  private metaCache = new PathCache<NextraPageMeta | null>({
    logTag: LogTags.NEXTRA_META,
    maxEntries: META_CACHE_MAX_ENTRIES,
  });
  private metaWatchTargets = new Map<string, MetaWatchTarget>();
  private trackedDocuments = new LRUCache<string, TrackedMetaDocument>({
    maxEntries: META_CACHE_MAX_ENTRIES,
    onEvict: (cacheKey, tracked) => {
      this.pruneTrackedDocument(cacheKey, tracked);
    },
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

    const cacheKey = JSON.stringify([
      normalizePathForComparison(workspaceRoot),
      normalizePathForComparison(mdxFilePath),
    ]);
    const candidates = this.getMetaCandidates(documentDir, workspaceRoot);
    this.trackMetaCandidates(cacheKey, mdxFilePath, candidates);

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
    if (!isPathWithin(startDir, workspaceRoot)) {
      return undefined;
    }

    return findUp({
      filename: '_meta.json',
      startDir,
      stopAt: createContainmentStopPredicate(workspaceRoot),
    });
  }

  // collect every creation candidate through the inclusive workspace boundary
  private getMetaCandidates(startDir: string, workspaceRoot: string): string[] {
    if (!isPathWithin(startDir, workspaceRoot)) {
      return [];
    }

    const candidates: string[] = [];
    let currentDir = startDir;
    while (isPathWithin(currentDir, workspaceRoot)) {
      candidates.push(path.join(currentDir, '_meta.json'));
      if (
        normalizePathForComparison(currentDir) ===
        normalizePathForComparison(workspaceRoot)
      ) {
        break;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
    return candidates;
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

  // associate one document cache entry w/ every metadata path that can affect it
  private trackMetaCandidates(
    cacheKey: string,
    mdxFilePath: string,
    candidates: string[]
  ): void {
    if (candidates.length === 0) {
      return;
    }

    const tracked = this.trackedDocuments.get(cacheKey);
    if (tracked) {
      return;
    }

    const documentPath = normalizePathForComparison(mdxFilePath);
    const targetKeys = new Set<string>();

    for (const candidate of candidates) {
      const targetKey = normalizePathForComparison(candidate);
      targetKeys.add(targetKey);
      let target = this.metaWatchTargets.get(targetKey);
      if (!target) {
        target = { path: candidate, cacheKeys: new Set() };
        this.metaWatchTargets.set(targetKey, target);
      }
      target.cacheKeys.add(cacheKey);
    }

    this.setupMetaWatcher();
    this.trackedDocuments.set(cacheKey, { documentPath, targetKeys });
  }

  // retain one workspace glob so missing metadata creation stays detectable
  private setupMetaWatcher(): void {
    if (this.metaCache.hasWatcher(META_WATCH_PATTERN)) {
      return;
    }

    const handleChange = (eventPath: string) =>
      this.handleMetaChange(normalizePathForComparison(eventPath));
    this.metaCache.watchPath(META_WATCH_PATTERN, {
      onChange: handleChange,
      onCreate: handleChange,
      onDelete: handleChange,
    });
  }

  // invalidate all documents that share this metadata candidate
  private handleMetaChange(targetKey: string): void {
    const target = this.metaWatchTargets.get(targetKey);
    if (!target) {
      return;
    }

    log.debug(`_meta.json changed: ${target.path}`);
    for (const cacheKey of target.cacheKeys) {
      this.metaCache.delete(cacheKey);
    }
    this.refreshAffectedPreview(target.cacheKeys);
  }

  // refresh the current preview only when its document depends on this path
  private refreshAffectedPreview(cacheKeys: ReadonlySet<string>): void {
    try {
      const previewManager = getPreviewManager();
      const preview = previewManager.getCurrentPreview();
      if (!preview) {
        return;
      }

      const currentDocumentPath = normalizePathForComparison(
        preview.doc.uri.fsPath
      );
      const isAffected = [...cacheKeys].some(
        (cacheKey) =>
          this.trackedDocuments.peek(cacheKey)?.documentPath ===
          currentDocumentPath
      );
      if (!isAffected) {
        return;
      }

      void previewManager.refreshAllPreviews().catch((error: unknown) => {
        log.debug(
          `Failed to refresh preview after _meta.json change: ${error}`
        );
      });
    } catch (error: unknown) {
      log.debug(`Failed to schedule _meta.json preview refresh: ${error}`);
    }
  }

  // prune historical indexes & watchers when the document LRU evicts
  private pruneTrackedDocument(
    cacheKey: string,
    tracked: TrackedMetaDocument
  ): void {
    this.metaCache.delete(cacheKey);

    for (const targetKey of tracked.targetKeys) {
      const target = this.metaWatchTargets.get(targetKey);
      if (!target) {
        continue;
      }
      target.cacheKeys.delete(cacheKey);
      if (target.cacheKeys.size > 0) {
        continue;
      }
      this.metaWatchTargets.delete(targetKey);
    }
  }

  // clear resolved metadata while preserving armed watcher tracking
  clearCaches(): void {
    this.metaCache.clear();
    log.debug('Caches cleared');
  }

  // clean up all file watchers & caches on dispose
  protected override onDispose(): void {
    this.trackedDocuments.clearWithEviction();
    this.metaCache.dispose();
    this.metaWatchTargets.clear();
    log.debug('Disposed');
  }
}

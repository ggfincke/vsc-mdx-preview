// packages/extension-host/src/features/preview/watchers/DependencyWatcher.ts
// reconcile durable exact watchers for local preview dependencies

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LogTags,
  type ModuleDependency,
  type ModuleDependencyKind,
} from '@mdx-preview/contracts';
import { LRUCache } from '@mdx-preview/runtime-utils';
import { getErrorReporter } from '../../../app/services';
import { DEP_WATCHER_MAX_ENTRIES } from '../../../shared/constants';
import { ErrorContext } from '../../../shared/errors';
import { createExactFileWatcherPattern } from '../../../shared/utils/createFileWatcher';
import { normalizePathForComparison } from '../../../shared/utils/path-utils';
import { getFileProbeCandidatePaths } from '../../module-runtime/resolution/file-prober';
import { getEligibleLocalResolutionPath } from '../../module-runtime/resolution/local-resolution-policy';
import { invalidateResolution } from '../../module-runtime/resolution/resolver-factory';
import { getUnifiedResolver } from '../../module-runtime/resolution/UnifiedResolver';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
} from '../../module-runtime/types/module-system';
import { BaseWatcher } from './BaseWatcher';

interface WatchedDependency {
  fsPath: string;
  watcher: vscode.FileSystemWatcher;
}

interface WatchOnlyOwner {
  fsPath: string;
  dependencies: Map<string, string>;
}

interface DependencyPathSet {
  candidatePaths: Map<string, string>;
  resolvedPaths: Map<string, string>;
}

interface ModuleDependencyOwner extends DependencyPathSet {
  fsPath: string;
}

interface DependencyRequest {
  kind?: ModuleDependencyKind;
  specifier: string;
}

type FileProbeCandidatePaths = ReturnType<typeof getFileProbeCandidatePaths>;

// watch local file dependencies w/ one bounded reconciled owner set
export class DependencyWatcher extends BaseWatcher {
  protected readonly logTag = LogTags.DEP_WATCHER;
  private readonly resolver = getUnifiedResolver();
  private readonly watchers: LRUCache<string, WatchedDependency>;
  private readonly onChangeCallback: (fsPath: string) => void | Promise<void>;
  private resolutionContext: ResolutionContext | null = null;
  private canonicalWorkspaceRoot: string | null = null;
  private resolvedSpecifierPaths = new Map<string, string>();
  private candidateSpecifierPaths = new Map<string, string>();
  private moduleDependencyOwners = new Map<string, ModuleDependencyOwner>();
  private watchOnlyOwners = new Map<string, WatchOnlyOwner>();
  private committedOwnerKeys = new Set<string>();
  private generation = 0;

  constructor(onChange: (fsPath: string) => void | Promise<void>) {
    super();
    this.onChangeCallback = onChange;
    this.watchers = new LRUCache({
      maxEntries: DEP_WATCHER_MAX_ENTRIES,
      onEvict: (_key, dependency) => {
        this.log.debug(`Disposing watcher: ${dependency.fsPath}`);
        dependency.watcher.dispose();
      },
    });
  }

  // replace the full context used by dependency resolution
  setResolutionContext(context: ResolutionContext | null): void {
    this.resolutionContext = context;
    this.canonicalWorkspaceRoot = context?.workspaceRoot
      ? this.canonicalizePotentialPath(context.workspaceRoot)
      : null;
    this.markReady();
  }

  // begin one current evaluation & prune modules unreachable from its entry
  updateDependencies(dependencies: readonly ModuleDependency[]): number {
    this.generation += 1;
    this.committedOwnerKeys.clear();
    const nextPaths = this.resolveDependencies(
      dependencies,
      this.resolutionContext
    );
    this.resolvedSpecifierPaths = nextPaths.resolvedPaths;
    this.candidateSpecifierPaths = nextPaths.candidatePaths;
    this.pruneUnreachableOwners();
    this.reconcileWatchers();
    return this.generation;
  }

  // commit the first fetched snapshot for one module in this evaluation
  commitModuleDependencySnapshot(
    ownerFsPath: string,
    dependencies: readonly ModuleDependency[],
    watchFiles: string[] | undefined,
    generation = this.generation
  ): void {
    if (generation !== this.generation) {
      return;
    }

    const canonicalOwner = this.canonicalizeExistingPath(ownerFsPath);
    if (!canonicalOwner) {
      return;
    }

    const ownerKey = this.getPathKey(canonicalOwner);
    if (
      this.committedOwnerKeys.has(ownerKey) ||
      !this.getReachableResolvedPaths().has(ownerKey)
    ) {
      return;
    }

    const context = this.resolutionContext
      ? {
          ...this.resolutionContext,
          baseDir: path.dirname(canonicalOwner),
        }
      : null;
    const nextPaths = this.resolveDependencies(dependencies, context);
    this.moduleDependencyOwners.set(ownerKey, {
      fsPath: canonicalOwner,
      ...nextPaths,
    });
    if (watchFiles !== undefined) {
      const watchOnlyDependencies = new Map<string, string>();
      for (const watchFile of watchFiles) {
        const eligiblePath = this.getEligibleWatchOnlyPath(watchFile);
        if (!eligiblePath || this.getPathKey(eligiblePath) === ownerKey) {
          continue;
        }
        watchOnlyDependencies.set(this.getPathKey(eligiblePath), eligiblePath);
      }
      this.watchOnlyOwners.set(ownerKey, {
        fsPath: canonicalOwner,
        dependencies: watchOnlyDependencies,
      });
    }
    this.committedOwnerKeys.add(ownerKey);
    this.pruneUnreachableOwners();
    this.reconcileWatchers();
  }

  // return only paths that still have live watcher ownership
  getWatchedFsPaths(): string[] {
    return [...this.watchers.entries()].map(
      ([, dependency]) => dependency.fsPath
    );
  }

  // return complete live graph ownership independent of the exact watcher cap
  getOwnedFsPaths(): string[] {
    return [...this.getDesiredPaths().values()];
  }

  getGeneration(): number {
    return this.generation;
  }

  // expand a partial change to every compiled stylesheet cache owner
  getInvalidationPaths(fsPath: string): string[] {
    const paths = new Map<string, string>();
    paths.set(this.getPathKey(fsPath), fsPath);
    const changedKey = this.getPathKey(fsPath);

    for (const owner of this.watchOnlyOwners.values()) {
      if (owner.dependencies.has(changedKey)) {
        paths.set(this.getPathKey(owner.fsPath), owner.fsPath);
      }
    }

    return [...paths.values()];
  }

  // apply the same canonical local policy to a fetched browser resolution
  getEligibleResolutionPath(
    request: string,
    result: ResolutionResult | null
  ): string | null {
    return this.getEligibleResolutionPathForContext(
      request,
      result,
      this.resolutionContext
    );
  }

  private getEligibleResolutionPathForContext(
    request: string,
    result: ResolutionResult | null,
    context: ResolutionContext | null
  ): string | null {
    const canonicalPath = result
      ? this.canonicalizeExistingPath(result.fsPath)
      : null;

    return getEligibleLocalResolutionPath(
      request,
      result,
      context?.workspaceRoot,
      canonicalPath,
      this.canonicalWorkspaceRoot,
      { allowBareWorkspacePackages: true }
    );
  }

  clear(): void {
    this.generation += 1;
    this.resolvedSpecifierPaths.clear();
    this.candidateSpecifierPaths.clear();
    this.moduleDependencyOwners.clear();
    this.watchOnlyOwners.clear();
    this.committedOwnerKeys.clear();
    this.watchers.clearWithEviction();
  }

  protected onStart(): void {
    // exact watchers are installed by whole-graph reconciliation
  }

  protected onStop(): void {
    this.clear();
  }

  protected onDispose(): void {
    this.clear();
  }

  protected checkReadiness(): boolean {
    return this.resolutionContext !== null;
  }

  private resolveDependencies(
    dependencies: readonly DependencyRequest[],
    context: ResolutionContext | null
  ): DependencyPathSet {
    const resolvedPaths = new Map<string, string>();
    const candidatePaths = new Map<string, string>();
    if (!context) {
      return { candidatePaths, resolvedPaths };
    }

    for (const dependency of dependencies) {
      const request = dependency.specifier;
      if (!this.resolver.shouldResolve(request)) {
        continue;
      }

      const dependencyContext = dependency.kind
        ? { ...context, dependencyKind: dependency.kind }
        : context;
      const result = this.resolver.resolveSync(
        request,
        dependencyContext,
        'dependency'
      );
      const resolvedPath = this.getEligibleResolutionPathForContext(
        request,
        result,
        dependencyContext
      );
      if (resolvedPath) {
        const resolvedKey = this.getPathKey(resolvedPath);
        resolvedPaths.set(resolvedKey, resolvedPath);
        continue;
      }

      if (result || !this.resolver.isRelativeImport(request)) {
        continue;
      }

      const missingCandidates = this.getMissingCandidatePaths(
        request,
        dependencyContext
      );
      const newCandidates = missingCandidates.filter(
        (candidatePath) => !candidatePaths.has(this.getPathKey(candidatePath))
      );
      for (const candidatePath of newCandidates) {
        candidatePaths.set(this.getPathKey(candidatePath), candidatePath);
      }
    }

    return { candidatePaths, resolvedPaths };
  }

  // retain every exact candidate used by extensionless relative probing
  private getMissingCandidatePaths(
    request: string,
    context: ResolutionContext
  ): string[] {
    const basePath = path.resolve(context.baseDir, request);
    const candidates = getFileProbeCandidatePaths(basePath);

    return this.filterEligibleCandidatePaths(request, candidates, context);
  }

  private filterEligibleCandidatePaths(
    request: string,
    candidates: FileProbeCandidatePaths,
    context: ResolutionContext
  ): string[] {
    const eligiblePaths: string[] = [];

    for (const candidatePath of [
      ...candidates.exactAndExtensionPaths,
      ...candidates.indexPaths,
    ]) {
      const canonicalPath = this.canonicalizePotentialPath(candidatePath);
      const result: ResolutionResult = {
        fsPath: candidatePath,
        isBuiltInShim: false,
        specifier: request,
        strategy: ResolutionStrategy.FileProbe,
      };
      const eligiblePath = getEligibleLocalResolutionPath(
        request,
        result,
        context?.workspaceRoot,
        canonicalPath,
        this.canonicalWorkspaceRoot
      );
      if (eligiblePath) {
        eligiblePaths.push(eligiblePath);
      }
    }

    return eligiblePaths;
  }

  private getEligibleWatchOnlyPath(fsPath: string): string | null {
    const context = this.resolutionContext;
    const canonicalPath = this.canonicalizeExistingPath(fsPath);
    const result: ResolutionResult = {
      fsPath,
      isBuiltInShim: false,
      specifier: './watch-only',
      strategy: ResolutionStrategy.FileProbe,
    };

    return getEligibleLocalResolutionPath(
      './watch-only',
      result,
      context?.workspaceRoot,
      canonicalPath,
      this.canonicalWorkspaceRoot
    );
  }

  // resolve symlinks through the nearest existing ancestor for missing paths
  private canonicalizePotentialPath(targetPath: string): string | null {
    let currentPath = path.resolve(targetPath);
    const missingSegments: string[] = [];

    while (!fs.existsSync(currentPath)) {
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        return null;
      }
      missingSegments.unshift(path.basename(currentPath));
      currentPath = parentPath;
    }

    const canonicalAncestor = this.canonicalizeExistingPath(currentPath);
    return canonicalAncestor
      ? path.join(canonicalAncestor, ...missingSegments)
      : null;
  }

  private canonicalizeExistingPath(targetPath: string): string | null {
    try {
      return path.normalize(fs.realpathSync(targetPath));
    } catch {
      return null;
    }
  }

  private getPathKey(fsPath: string): string {
    return normalizePathForComparison(fsPath);
  }

  private getReachableResolvedPaths(): Map<string, string> {
    const reachablePaths = new Map(this.resolvedSpecifierPaths);
    const pendingOwnerKeys = [...reachablePaths.keys()];

    for (let index = 0; index < pendingOwnerKeys.length; index += 1) {
      const owner = this.moduleDependencyOwners.get(pendingOwnerKeys[index]);
      if (!owner) {
        continue;
      }

      for (const [dependencyKey, dependencyPath] of owner.resolvedPaths) {
        if (reachablePaths.has(dependencyKey)) {
          continue;
        }
        reachablePaths.set(dependencyKey, dependencyPath);
        pendingOwnerKeys.push(dependencyKey);
      }
    }

    return reachablePaths;
  }

  // keep fetched edges & Sass metadata only while reachable from the entry
  private pruneUnreachableOwners(): void {
    const reachablePaths = this.getReachableResolvedPaths();

    for (const ownerKey of this.moduleDependencyOwners.keys()) {
      if (!reachablePaths.has(ownerKey)) {
        this.moduleDependencyOwners.delete(ownerKey);
      }
    }
    for (const ownerKey of this.watchOnlyOwners.keys()) {
      if (!reachablePaths.has(ownerKey)) {
        this.watchOnlyOwners.delete(ownerKey);
      }
    }
  }

  // reconcile to one deterministic set before the LRU safety bound applies
  private reconcileWatchers(): void {
    const desiredPaths = this.getDesiredPaths();

    const boundedPaths = new Map(
      [...desiredPaths].slice(0, DEP_WATCHER_MAX_ENTRIES)
    );
    if (boundedPaths.size < desiredPaths.size) {
      this.log.warn(
        `Dependency watcher limit reached: retaining ${boundedPaths.size} of ${desiredPaths.size} exact paths`
      );
    }

    for (const key of [...this.watchers.keys()]) {
      if (!boundedPaths.has(key)) {
        this.watchers.delete(key);
      }
    }

    for (const [key, fsPath] of boundedPaths) {
      if (this.watchers.has(key)) {
        this.watchers.get(key);
        continue;
      }

      const watcher = this.createFileWatcher(
        createExactFileWatcherPattern(fsPath),
        {
          onCreate: () => this.handleDependencyEvent(fsPath),
          onChange: () => this.handleDependencyEvent(fsPath),
          onDelete: () => this.handleDependencyEvent(fsPath),
        }
      );
      this.watchers.set(key, { fsPath, watcher });
    }

    this.log.debug(`Watching ${this.watchers.size} exact local dependencies`);
  }

  private getDesiredPaths(): Map<string, string> {
    const desiredPaths = new Map<string, string>();
    const reachablePaths = this.getReachableResolvedPaths();

    for (const [key, fsPath] of reachablePaths) {
      desiredPaths.set(key, fsPath);
    }
    for (const owner of this.watchOnlyOwners.values()) {
      for (const [key, fsPath] of owner.dependencies) {
        desiredPaths.set(key, fsPath);
      }
    }
    for (const [key, fsPath] of this.candidateSpecifierPaths) {
      desiredPaths.set(key, fsPath);
    }
    for (const ownerKey of reachablePaths.keys()) {
      const owner = this.moduleDependencyOwners.get(ownerKey);
      if (!owner) {
        continue;
      }
      for (const [key, fsPath] of owner.candidatePaths) {
        desiredPaths.set(key, fsPath);
      }
    }

    return desiredPaths;
  }

  // clear negative resolver state before any create/change/delete refresh
  private async handleDependencyEvent(fsPath: string): Promise<void> {
    try {
      invalidateResolution();
      await this.onChangeCallback(fsPath);
    } catch (error: unknown) {
      getErrorReporter().report(error, {
        context: ErrorContext.Extension,
        showNotification: false,
        metadata: {
          operation: 'dependency-watcher-refresh',
          fsPath,
        },
      });
    }
  }
}

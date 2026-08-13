// packages/extension-host/src/features/preview/PreviewDocumentHandler.ts
// document state management & change handling for preview instances

import * as vscode from 'vscode';
import * as path from 'path';
import type { ModuleDependency, UpdateModeValue } from '@mdx-preview/contracts';
import {
  findTsConfig,
  resolveTypescriptConfig,
} from './configuration/TypeScriptConfigResolver';
import { resolveConfig } from './configuration/ConfigResolver';
import type { TypeScriptConfiguration } from '../module-runtime/types/module-system';
import { buildResolutionContext } from '../module-runtime/resolution/resolution-context';
import type { ResolvedConfig } from '../../shared/config/types';
import { DocumentTracker } from './watchers/DocumentTracker';
import { DependencyWatcher } from './watchers/DependencyWatcher';
import { WatcherManager } from './watchers/WatcherManager';

// actions provided by Preview for document event handling
export interface PreviewActions {
  markStale: () => void;
  invalidate: (fsPath: string) => Promise<void>;
  debouncedUpdate: () => void;
  updateWebview: () => Promise<void>;
}

// handle document state, tracking, & change events for a preview instance
export class PreviewDocumentHandler {
  private actions?: PreviewActions;
  private _doc!: vscode.TextDocument;
  private _dependentFsPaths: Set<string> = new Set();
  private _typescriptConfiguration?: TypeScriptConfiguration;
  private _mdxPreviewConfig?: ResolvedConfig;

  get doc(): vscode.TextDocument {
    return this._doc;
  }

  get dependentFsPaths(): Set<string> {
    return this._dependentFsPaths;
  }

  get typescriptConfiguration(): TypeScriptConfiguration | undefined {
    return this._typescriptConfiguration;
  }

  set typescriptConfiguration(value: TypeScriptConfiguration | undefined) {
    this._typescriptConfiguration = value;
  }

  get mdxPreviewConfig(): ResolvedConfig | undefined {
    return this._mdxPreviewConfig;
  }

  // set actions for document event handling (called once after construction)
  setActions(actions: PreviewActions): void {
    this.actions = actions;
  }

  get fsPath(): string {
    return this._doc.uri.fsPath;
  }

  get text(): string {
    return this._doc.getText();
  }

  get entryFsDirectory(): string | null {
    if (this._doc.uri.scheme === 'untitled') {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }
      return workspaceFolders[0].uri.fsPath;
    } else if (this._doc.uri.scheme === 'file') {
      return path.dirname(this.fsPath);
    }
    return null;
  }

  // set the document & resolve related configurations
  setDoc(doc: vscode.TextDocument, watcherManager: WatcherManager): void {
    this._doc = doc;
    this._dependentFsPaths = new Set([doc.uri.fsPath]);

    const configFile = findTsConfig(this.entryFsDirectory ?? '');
    if (configFile) {
      this._typescriptConfiguration =
        resolveTypescriptConfig(configFile) ?? undefined;
    } else {
      this._typescriptConfiguration = undefined;
    }

    // resolve MDX preview config file (.mdx-previewrc.json)
    if (doc.uri.scheme === 'file') {
      this._mdxPreviewConfig = resolveConfig(doc.uri.fsPath) ?? undefined;
    } else {
      this._mdxPreviewConfig = undefined;
    }

    const dependencyWatcher =
      watcherManager.get<DependencyWatcher>('dependency');
    if (dependencyWatcher) {
      dependencyWatcher.clear();
      this.refreshDependencyResolutionContext(watcherManager);
    }
  }

  // update the MDX preview config (called after config file change)
  reloadMdxConfig(): void {
    this._mdxPreviewConfig = resolveConfig(this._doc.uri.fsPath) ?? undefined;
  }

  reloadTypescriptConfig(watcherManager: WatcherManager): void {
    const configFile = findTsConfig(this.entryFsDirectory ?? '');
    this._typescriptConfiguration = configFile
      ? (resolveTypescriptConfig(configFile) ?? undefined)
      : undefined;
    this.refreshDependencyResolutionContext(watcherManager);
  }

  // reset rendered version tracking (called when panel is disposed to force re-render)
  resetRenderedVersion(watcherManager: WatcherManager): void {
    const docTracker = watcherManager.get<DocumentTracker>('document');
    docTracker?.resetRenderedVersion();
  }

  // mark preview as stale (document changed but not rendered)
  markStale(watcherManager: WatcherManager): void {
    const docTracker = watcherManager.get<DocumentTracker>('document');
    docTracker?.markStale();
  }

  // update dependency watcher w/ new imports (called from evaluate-in-webview)
  updateDependencies(
    dependencies: readonly ModuleDependency[],
    watcherManager: WatcherManager
  ): void {
    this.refreshDependencyResolutionContext(watcherManager);
    const dependencyWatcher =
      watcherManager.get<DependencyWatcher>('dependency');
    dependencyWatcher?.updateDependencies(dependencies);
    this.reconcileDependentFsPaths(dependencyWatcher);
  }

  getDependencyGeneration(watcherManager: WatcherManager): number {
    return (
      watcherManager.get<DependencyWatcher>('dependency')?.getGeneration() ?? 0
    );
  }

  // commit one current fetched module snapshot atomically
  commitModuleDependencySnapshot(
    ownerFsPath: string,
    dependencies: readonly ModuleDependency[],
    watchFiles: string[] | undefined,
    watcherManager: WatcherManager,
    generation = this.getDependencyGeneration(watcherManager)
  ): void {
    const dependencyWatcher =
      watcherManager.get<DependencyWatcher>('dependency');
    dependencyWatcher?.commitModuleDependencySnapshot(
      ownerFsPath,
      dependencies,
      watchFiles,
      generation
    );
    this.reconcileDependentFsPaths(dependencyWatcher);
  }

  // include every cache owner when an exact dependency changes
  getDependencyInvalidationPaths(
    fsPath: string,
    watcherManager: WatcherManager
  ): string[] {
    const dependencyWatcher =
      watcherManager.get<DependencyWatcher>('dependency');
    return dependencyWatcher?.getInvalidationPaths(fsPath) ?? [fsPath];
  }

  // handle text document change event
  async handleDidChangeTextDocument(
    fsPath: string,
    _doc: vscode.TextDocument,
    active: boolean,
    updateMode: UpdateModeValue
  ): Promise<void> {
    if (!active) {
      return;
    }

    if (!this._dependentFsPaths.has(fsPath)) {
      return;
    }

    switch (updateMode) {
      case 'onType': {
        this.actions!.markStale();
        if (fsPath !== this.fsPath) {
          await this.actions!.invalidate(fsPath);
        }
        this.actions!.debouncedUpdate();
        break;
      }
      case 'onSave':
      case 'manual': {
        this.actions!.markStale();
        break;
      }
    }
  }

  // handle text document save event
  async handleDidSaveTextDocument(
    fsPath: string,
    active: boolean,
    updateMode: UpdateModeValue
  ): Promise<void> {
    if (!active) {
      return;
    }

    if (!this._dependentFsPaths.has(fsPath)) {
      return;
    }

    if (updateMode === 'manual') {
      this.actions!.markStale();
      return;
    }

    if (fsPath !== this.fsPath) {
      await this.actions!.invalidate(fsPath);
    }
    await this.actions!.updateWebview();
  }

  // rebuild framework, shim, workspace, & tsconfig inputs from active state
  private refreshDependencyResolutionContext(
    watcherManager: WatcherManager
  ): void {
    const dependencyWatcher =
      watcherManager.get<DependencyWatcher>('dependency');
    const entryFsDirectory = this.entryFsDirectory;
    if (!dependencyWatcher) {
      return;
    }
    if (!entryFsDirectory) {
      dependencyWatcher.setResolutionContext(null);
      return;
    }

    dependencyWatcher.setResolutionContext(
      buildResolutionContext({
        baseDir: entryFsDirectory,
        documentUri: this._doc.uri,
        entryFsDirectory,
        tsConfig: this._typescriptConfiguration,
      })
    );
  }

  private reconcileDependentFsPaths(
    dependencyWatcher: DependencyWatcher | undefined
  ): void {
    this._dependentFsPaths = new Set([
      this.fsPath,
      ...(dependencyWatcher?.getOwnedFsPaths() ?? []),
    ]);
  }
}

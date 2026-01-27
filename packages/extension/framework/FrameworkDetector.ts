// packages/extension/framework/FrameworkDetector.ts
// detect MDX framework from workspace package.json dependencies

import * as vscode from 'vscode';
import * as path from 'path';
import { debug } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { getConfigManager, getErrorReporter } from '../services';
import { SubscriberManager } from '../utils/SubscriberManager';
import { ErrorContext } from '../errors';
import { normalizeError, type FrameworkId } from '@mdx-preview/shared';
import { readJsonSync, pathExists } from '../utils/file-utils';
import { findUp } from '../utils/find-up';

// re-export FrameworkId as Framework for backward compatibility
export type Framework = FrameworkId;

// framework detection result
export interface FrameworkInfo {
  framework: Framework;
  // true = auto-detected, false = from setting
  detected: boolean;
  version?: string;
}

// framework detection rules
interface FrameworkRule {
  framework: Framework;
  // dependencies to check (any match = detected)
  dependencies: string[];
  // optional secondary dependencies (for frameworks that need multiple packages)
  secondaryDependencies?: string[];
}

// detection rules in priority order
const FRAMEWORK_RULES: FrameworkRule[] = [
  {
    framework: 'docusaurus',
    dependencies: ['@docusaurus/core', '@docusaurus/preset-classic'],
  },
  {
    framework: 'starlight',
    dependencies: ['@astrojs/starlight'],
  },
  // nextra detection must come before Next.js since Nextra projects also have 'next' dependency
  {
    framework: 'nextra',
    dependencies: ['nextra'],
  },
  {
    framework: 'nextra',
    dependencies: ['nextra-theme-docs'],
  },
  {
    framework: 'nextra',
    dependencies: ['nextra-theme-blog'],
  },
  {
    framework: 'nextjs',
    dependencies: ['next'],
    secondaryDependencies: ['@next/mdx', 'next-mdx-remote', '@mdx-js/react'],
  },
];

// singleton framework detector
export class FrameworkDetector extends SingletonService<FrameworkDetector> {
  protected static override instance: FrameworkDetector | undefined;
  protected readonly logTag = 'FRAMEWORK';

  private cache: Map<string, FrameworkInfo> = new Map();
  private subscriberManager = new SubscriberManager<FrameworkInfo>(
    'FRAMEWORK',
    (error) => {
      getErrorReporter().reportSilent(
        normalizeError(error),
        ErrorContext.Extension,
        { operation: 'framework-subscriber-notify' }
      );
    }
  );
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  // G.2 optimization: Track if file watcher has been lazily initialized
  private fileWatcherInitialized = false;

  protected constructor() {
    super();

    // G.2 optimization: FileSystemWatcher creation moved to ensureFileWatcher()
    // This defers the expensive watcher creation until first framework detection

    // watch for framework setting changes (lightweight, keep in constructor)
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview.framework')) {
          this.invalidateAllCaches();
        }
      })
    );
  }

  /**
   * Lazily initialize the FileSystemWatcher on first framework detection.
   * G.2 optimization: This defers the expensive watcher creation until actually needed,
   * reducing extension activation time.
   */
  private ensureFileWatcher(): void {
    if (this.fileWatcherInitialized) {
      return;
    }
    this.fileWatcherInitialized = true;

    debug('[FRAMEWORK] Initializing package.json FileSystemWatcher');

    // watch for package.json changes
    // createFileSystemWatcher args: ignoreCreate, ignoreChange, ignoreDelete
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      false,
      false,
      false
    );

    this.addDisposable(
      this.fileWatcher.onDidChange((uri) => this.onPackageJsonChange(uri))
    );
    this.addDisposable(
      this.fileWatcher.onDidCreate((uri) => this.onPackageJsonChange(uri))
    );
    this.addDisposable(
      this.fileWatcher.onDidDelete((uri) => this.onPackageJsonChange(uri))
    );
  }

  // detect framework from workspace root package.json
  detectFromPackageJson(workspaceRoot: string): FrameworkInfo {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');

    interface PackageJson {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }

    const packageJson = readJsonSync<PackageJson>(packageJsonPath, {
      logTag: '[FRAMEWORK]',
    });

    if (!packageJson) {
      debug('[FRAMEWORK] No package.json found or failed to parse at:', packageJsonPath);
      return { framework: 'generic', detected: true };
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // check each rule in priority order
    for (const rule of FRAMEWORK_RULES) {
      const hasPrimary = rule.dependencies.some((dep) => dep in allDeps);

      if (hasPrimary) {
        // for frameworks w/ secondary deps, at least one must be present
        if (rule.secondaryDependencies) {
          const hasSecondary = rule.secondaryDependencies.some(
            (dep) => dep in allDeps
          );
          if (!hasSecondary) {
            continue;
          }
        }

        const version = allDeps[rule.dependencies[0]];
        debug(`[FRAMEWORK] Detected ${rule.framework} (version: ${version})`);
        return {
          framework: rule.framework,
          detected: true,
          version: typeof version === 'string' ? version : undefined,
        };
      }
    }

    debug('[FRAMEWORK] No framework detected, using generic');
    return { framework: 'generic', detected: true };
  }

  // find the closest package.json starting from documentDir up to workspaceRoot
  // uses shared find-up utility
  private findClosestPackageJsonDir(
    documentDir: string,
    workspaceRoot: string
  ): string {
    const found = findUp({
      filename: 'package.json',
      startDir: documentDir,
      stopAt: workspaceRoot,
      returnType: 'directory',
    });

    if (found) {
      debug('[FRAMEWORK] Found package.json at:', path.join(found, 'package.json'));
      return found;
    }

    // fallback to workspace root
    return workspaceRoot;
  }

  // get framework for document (respects manual override)
  getFramework(documentUri: vscode.Uri): FrameworkInfo {
    // G.2 optimization: Lazy init file watcher on first use
    this.ensureFileWatcher();

    // check manual override setting first
    const manualFramework = getConfigManager().get('framework', documentUri);

    if (manualFramework !== 'auto') {
      // backward compatibility: migrate deprecated 'astro-starlight' to 'starlight'
      // cast to string for comparison since old user settings may have the deprecated value
      if ((manualFramework as string) === 'astro-starlight') {
        debug('[FRAMEWORK] Migrating deprecated "astro-starlight" to "starlight"');
        return {
          framework: 'starlight',
          detected: false,
        };
      }
      return {
        framework: manualFramework as Framework,
        detected: false,
      };
    }

    // get workspace root for this document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (!workspaceFolder) {
      return { framework: 'generic', detected: true };
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const documentDir = path.dirname(documentUri.fsPath);

    // find the closest package.json (from document dir up to workspace root)
    const packageJsonDir = this.findClosestPackageJsonDir(
      documentDir,
      workspaceRoot
    );

    // check cache using the package.json directory as key
    // (use undefined check for consistency w/ other cache access patterns)
    const cached = this.cache.get(packageJsonDir);
    if (cached !== undefined) {
      return cached;
    }

    // detect & cache framework
    const detected = this.detectFromPackageJson(packageJsonDir);
    this.cache.set(packageJsonDir, detected);
    return detected;
  }

  // get framework display name for UI
  getFrameworkDisplayName(framework: Framework): string {
    switch (framework) {
      case 'docusaurus':
        return 'Docusaurus';
      case 'nextjs':
        return 'Next.js';
      case 'starlight':
        return 'Starlight';
      case 'nextra':
        return 'Nextra';
      case 'generic':
      default:
        return 'Generic';
    }
  }

  // check if component shims are enabled
  areShimsEnabled(documentUri: vscode.Uri): boolean {
    return getConfigManager().get('framework.componentShims', documentUri);
  }

  // find mdx-components.tsx file (for Next.js)
  findMdxComponentsFile(workspaceRoot: string): string | null {
    const candidates = [
      'mdx-components.tsx',
      'mdx-components.ts',
      'mdx-components.js',
      'mdx-components.jsx',
      'src/mdx-components.tsx',
      'src/mdx-components.ts',
      'src/mdx-components.js',
      'src/mdx-components.jsx',
    ];

    for (const candidate of candidates) {
      const fullPath = path.join(workspaceRoot, candidate);
      if (pathExists(fullPath)) {
        debug('[FRAMEWORK] Found mdx-components file:', fullPath);
        return fullPath;
      }
    }

    return null;
  }

  // subscribe to framework changes
  subscribe(callback: (info: FrameworkInfo) => void): vscode.Disposable {
    return this.subscriberManager.subscribe(callback);
  }

  // notify subscribers of framework change
  private notifySubscribers(info: FrameworkInfo): void {
    this.subscriberManager.notify(info);
  }

  // invalidate cache for workspace
  invalidateCache(workspaceRoot: string): void {
    this.cache.delete(workspaceRoot);
    debug('[FRAMEWORK] Cache invalidated for:', workspaceRoot);
  }

  // invalidate all caches & notify subscribers
  private invalidateAllCaches(): void {
    this.cache.clear();
    debug('[FRAMEWORK] All caches invalidated');

    // notify subscribers w/ current framework for active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const info = this.getFramework(editor.document.uri);
      this.notifySubscribers(info);
    }
  }

  // handle package.json change & invalidate cache
  private onPackageJsonChange(uri: vscode.Uri): void {
    // invalidate the cache for the directory containing this package.json
    const packageJsonDir = path.dirname(uri.fsPath);
    this.invalidateCache(packageJsonDir);

    // notify subscribers if this affects the active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const editorFolder = vscode.workspace.getWorkspaceFolder(
        editor.document.uri
      );
      // check if the changed package.json is in the same workspace
      if (
        workspaceFolder &&
        editorFolder?.uri.fsPath === workspaceFolder.uri.fsPath
      ) {
        const info = this.getFramework(editor.document.uri);
        this.notifySubscribers(info);
      }
    }
  }

  // clear file watcher, cache, & subscriptions on dispose
  protected override onDispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }

    this.cache.clear();
    this.subscriberManager.clear();
  }
}

// packages/extension/framework/FrameworkDetector.ts
// detect MDX framework from workspace package.json dependencies

import * as vscode from 'vscode';
import * as path from 'path';
import { createTaggedLogger } from '../logging';
import { WithSubscribers } from '../services/SingletonService';
import { getConfigManager, getErrorReporter } from '../services';
import { ErrorContext } from '../errors';
import { normalizeError, LogTags, type FrameworkId } from '@mdx-preview/shared';
import { readJsonSync, pathExists } from '../utils/file-utils';

const log = createTaggedLogger(LogTags.FRAMEWORK);
import { findUp } from '../utils/find-up';
import { PathCache } from '../utils/cache';

// framework detection result
export interface FrameworkInfo {
  framework: FrameworkId;
  // true = auto-detected, false = from setting
  detected: boolean;
  version?: string;
}

// framework detection rules
interface FrameworkRule {
  framework: FrameworkId;
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
  // nextra detection must come before nextjs since nextra projects have 'next' dependency
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

// * singleton framework detector w/ auto-detection & caching
export class FrameworkDetector extends WithSubscribers<
  FrameworkDetector,
  FrameworkInfo
> {
  protected static override instance: FrameworkDetector | undefined;
  protected readonly logTag = LogTags.FRAMEWORK;

  private cache = new PathCache<FrameworkInfo>({
    logTag: LogTags.FRAMEWORK,
  });
  private watcherReady = false;

  protected constructor() {
    super(LogTags.FRAMEWORK, (error) => {
      getErrorReporter().reportSilent(
        normalizeError(error),
        ErrorContext.Extension,
        { operation: 'framework-subscriber-notify' }
      );
    });

    // G.2 optimization: defer FileSystemWatcher creation to ensureFileWatcher()

    // watch for framework setting changes via centralized dispatcher
    this.addDisposable(
      getConfigManager().onDidChangeKey('framework', () => {
        this.invalidateAllCaches();
      })
    );
  }

  // G.2 optimization: lazily initialize FileSystemWatcher on first detection
  private ensureFileWatcher(): void {
    if (!this.watcherReady) {
      log.debug('Initializing package.json FileSystemWatcher');

      this.cache.watchPath('**/package.json', {
        onChange: (eventPath) => this.onPackageJsonChange(eventPath),
        onCreate: (eventPath) => this.onPackageJsonChange(eventPath),
        onDelete: (eventPath) => this.onPackageJsonChange(eventPath),
      });

      this.watcherReady = true;
    }
  }

  // detect framework from workspace root package.json
  detectFromPackageJson(workspaceRoot: string): FrameworkInfo {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');

    interface PackageJson {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }

    const packageJson = readJsonSync<PackageJson>(packageJsonPath, {
      logger: log,
    });

    if (!packageJson) {
      log.debug(
        'No package.json found or failed to parse at:',
        packageJsonPath
      );
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
        log.debug(`Detected ${rule.framework} (version: ${version})`);
        return {
          framework: rule.framework,
          detected: true,
          version: typeof version === 'string' ? version : undefined,
        };
      }
    }

    log.debug('No framework detected, using generic');
    return { framework: 'generic', detected: true };
  }

  // find closest package.json from documentDir up to workspaceRoot
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
      log.debug('Found package.json at:', path.join(found, 'package.json'));
      return found;
    }

    // fallback to workspace root
    return workspaceRoot;
  }

  // get framework for document (respects manual override)
  getFramework(documentUri: vscode.Uri): FrameworkInfo {
    // G.2 optimization: lazy init file watcher on first use
    this.ensureFileWatcher();

    // check manual override setting first
    const manualFramework = getConfigManager().get('framework', documentUri);

    if (manualFramework !== 'auto') {
      return {
        framework: manualFramework as FrameworkId,
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
  getFrameworkDisplayName(framework: FrameworkId): string {
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
        log.debug('Found mdx-components file:', fullPath);
        return fullPath;
      }
    }

    return null;
  }

  // notify subscribers of framework change
  private notifyFrameworkSubscribers(info: FrameworkInfo): void {
    this.notifySubscribers(info);
  }

  // invalidate cache for workspace
  invalidateCache(workspaceRoot: string): void {
    this.cache.delete(workspaceRoot);
    log.debug('Cache invalidated for:', workspaceRoot);
  }

  // invalidate all caches & notify subscribers
  private invalidateAllCaches(): void {
    this.cache.clear();
    log.debug('All caches invalidated');

    // notify subscribers w/ current framework for active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const info = this.getFramework(editor.document.uri);
      this.notifyFrameworkSubscribers(info);
    }
  }

  // handle package.json change & invalidate cache
  private onPackageJsonChange(fsPath: string): void {
    // invalidate the cache for the directory containing this package.json
    const packageJsonDir = path.dirname(fsPath);
    this.invalidateCache(packageJsonDir);

    // notify subscribers if this affects the active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        vscode.Uri.file(fsPath)
      );
      const editorFolder = vscode.workspace.getWorkspaceFolder(
        editor.document.uri
      );
      // check if the changed package.json is in the same workspace
      if (
        workspaceFolder &&
        editorFolder?.uri.fsPath === workspaceFolder.uri.fsPath
      ) {
        const info = this.getFramework(editor.document.uri);
        this.notifyFrameworkSubscribers(info);
      }
    }
  }

  // clear file watcher, cache & subscriptions on dispose
  protected override onDispose(): void {
    this.cache.dispose();
  }
}

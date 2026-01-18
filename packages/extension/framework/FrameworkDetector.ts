// packages/extension/framework/FrameworkDetector.ts
// detect MDX framework from workspace package.json dependencies

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { debug } from '../logging';
import { SingletonService } from '../services/SingletonService';
import { getConfigManager, getErrorReporter } from '../services';
import { ErrorContext } from '../errors';

// supported frameworks
export type Framework =
  | 'generic'
  | 'docusaurus'
  | 'nextjs'
  | 'astro-starlight'
  | 'nextra';

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
    dependencies: ['@docusaurus/core'],
  },
  {
    framework: 'astro-starlight',
    dependencies: ['@astrojs/starlight'],
  },
  // Nextra detection must come before Next.js since Nextra projects also have 'next' dependency
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
  private subscriptions: Set<(info: FrameworkInfo) => void> = new Set();
  private fileWatcher: vscode.FileSystemWatcher | null = null;

  protected constructor() {
    super();

    // Watch for package.json changes
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json',
      false, // create
      false, // change
      false // delete
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

    // Watch for framework setting changes
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview.framework')) {
          this.invalidateAllCaches();
        }
      })
    );
  }

  // Detect framework from workspace root package.json
  detectFromPackageJson(workspaceRoot: string): FrameworkInfo {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');

    try {
      if (!fs.existsSync(packageJsonPath)) {
        debug('[FRAMEWORK] No package.json found at:', packageJsonPath);
        return { framework: 'generic', detected: true };
      }

      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check each rule in priority order
      for (const rule of FRAMEWORK_RULES) {
        const hasPrimary = rule.dependencies.some((dep) => dep in allDeps);

        if (hasPrimary) {
          // For frameworks w/ secondary deps, at least one must be present
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
    } catch (error) {
      getErrorReporter().reportSilent(
        error instanceof Error ? error : new Error(String(error)),
        ErrorContext.Extension,
        { operation: 'framework-detection', file: packageJsonPath }
      );
      return { framework: 'generic', detected: true };
    }
  }

  // Find the closest package.json starting from documentDir up to workspaceRoot
  private findClosestPackageJsonDir(
    documentDir: string,
    workspaceRoot: string
  ): string {
    let currentDir = documentDir;

    // Walk up from document directory to workspace root
    while (currentDir.startsWith(workspaceRoot)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        debug('[FRAMEWORK] Found package.json at:', packageJsonPath);
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      // Stop if we've reached the root or can't go up further
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    // Fallback to workspace root
    return workspaceRoot;
  }

  // Get framework for document (respects manual override)
  getFramework(documentUri: vscode.Uri): FrameworkInfo {
    // Check manual override setting first
    const manualFramework = getConfigManager().get('framework', documentUri);

    if (manualFramework !== 'auto') {
      return {
        framework: manualFramework as Framework,
        detected: false,
      };
    }

    // Get workspace root for this document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (!workspaceFolder) {
      return { framework: 'generic', detected: true };
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const documentDir = path.dirname(documentUri.fsPath);

    // Find the closest package.json (from document dir up to workspace root)
    const packageJsonDir = this.findClosestPackageJsonDir(
      documentDir,
      workspaceRoot
    );

    // Check cache using the package.json directory as key
    const cached = this.cache.get(packageJsonDir);
    if (cached) {
      return cached;
    }

    // Detect & cache framework
    const detected = this.detectFromPackageJson(packageJsonDir);
    this.cache.set(packageJsonDir, detected);
    return detected;
  }

  // Get framework display name for UI
  getFrameworkDisplayName(framework: Framework): string {
    switch (framework) {
      case 'docusaurus':
        return 'Docusaurus';
      case 'nextjs':
        return 'Next.js';
      case 'astro-starlight':
        return 'Starlight';
      case 'nextra':
        return 'Nextra';
      case 'generic':
      default:
        return 'Generic';
    }
  }

  // Check if component shims are enabled
  areShimsEnabled(documentUri: vscode.Uri): boolean {
    return getConfigManager().get('framework.componentShims', documentUri);
  }

  // Find mdx-components.tsx file (for Next.js)
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
      if (fs.existsSync(fullPath)) {
        debug('[FRAMEWORK] Found mdx-components file:', fullPath);
        return fullPath;
      }
    }

    return null;
  }

  // Subscribe to framework changes
  subscribe(callback: (info: FrameworkInfo) => void): vscode.Disposable {
    this.subscriptions.add(callback);
    return new vscode.Disposable(() => {
      this.subscriptions.delete(callback);
    });
  }

  // Notify subscribers of framework change
  private notifySubscribers(info: FrameworkInfo): void {
    for (const callback of this.subscriptions) {
      try {
        callback(info);
      } catch (error) {
        getErrorReporter().reportSilent(
          error instanceof Error ? error : new Error(String(error)),
          ErrorContext.Extension,
          { operation: 'framework-subscriber-notify' }
        );
      }
    }
  }

  // Invalidate cache for workspace
  invalidateCache(workspaceRoot: string): void {
    this.cache.delete(workspaceRoot);
    debug('[FRAMEWORK] Cache invalidated for:', workspaceRoot);
  }

  // Invalidate all caches & notify subscribers
  private invalidateAllCaches(): void {
    this.cache.clear();
    debug('[FRAMEWORK] All caches invalidated');

    // Notify subscribers w/ current framework for active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const info = this.getFramework(editor.document.uri);
      this.notifySubscribers(info);
    }
  }

  // Handle package.json change & invalidate cache
  private onPackageJsonChange(uri: vscode.Uri): void {
    // Invalidate the cache for the directory containing this package.json
    const packageJsonDir = path.dirname(uri.fsPath);
    this.invalidateCache(packageJsonDir);

    // Notify subscribers if this affects the active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const editorFolder = vscode.workspace.getWorkspaceFolder(
        editor.document.uri
      );
      // Check if the changed package.json is in the same workspace
      if (
        workspaceFolder &&
        editorFolder?.uri.fsPath === workspaceFolder.uri.fsPath
      ) {
        const info = this.getFramework(editor.document.uri);
        this.notifySubscribers(info);
      }
    }
  }

  // Clear file watcher, cache, & subscriptions on dispose
  protected override onDispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }

    this.cache.clear();
    this.subscriptions.clear();
  }
}

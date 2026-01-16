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
export type Framework = 'generic' | 'docusaurus' | 'nextjs' | 'astro-starlight';

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

    // watch for package.json changes
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

    // watch for setting changes
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview.framework')) {
          this.invalidateAllCaches();
        }
      })
    );
  }

  // detect framework from package.json in workspace root
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
    } catch (error) {
      getErrorReporter().reportSilent(
        error instanceof Error ? error : new Error(String(error)),
        ErrorContext.Extension,
        { operation: 'framework-detection', file: packageJsonPath }
      );
      return { framework: 'generic', detected: true };
    }
  }

  // get framework for a document (respects manual override)
  getFramework(documentUri: vscode.Uri): FrameworkInfo {
    // check manual override setting first
    const manualFramework = getConfigManager().get('framework', documentUri);

    if (manualFramework !== 'auto') {
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

    // check cache
    const cached = this.cache.get(workspaceRoot);
    if (cached) {
      return cached;
    }

    // detect & cache
    const detected = this.detectFromPackageJson(workspaceRoot);
    this.cache.set(workspaceRoot, detected);
    return detected;
  }

  // get framework display name for UI
  getFrameworkDisplayName(framework: Framework): string {
    switch (framework) {
      case 'docusaurus':
        return 'Docusaurus';
      case 'nextjs':
        return 'Next.js';
      case 'astro-starlight':
        return 'Starlight';
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
      if (fs.existsSync(fullPath)) {
        debug('[FRAMEWORK] Found mdx-components file:', fullPath);
        return fullPath;
      }
    }

    return null;
  }

  // subscribe to framework changes
  subscribe(callback: (info: FrameworkInfo) => void): vscode.Disposable {
    this.subscriptions.add(callback);
    return new vscode.Disposable(() => {
      this.subscriptions.delete(callback);
    });
  }

  // notify subscribers
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

  // invalidate cache for a workspace
  invalidateCache(workspaceRoot: string): void {
    this.cache.delete(workspaceRoot);
    debug('[FRAMEWORK] Cache invalidated for:', workspaceRoot);
  }

  // invalidate all caches
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

  // handle package.json change
  private onPackageJsonChange(uri: vscode.Uri): void {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      this.invalidateCache(workspaceFolder.uri.fsPath);

      // notify subscribers if this affects the active editor
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const editorFolder = vscode.workspace.getWorkspaceFolder(
          editor.document.uri
        );
        if (editorFolder?.uri.fsPath === workspaceFolder.uri.fsPath) {
          const info = this.getFramework(editor.document.uri);
          this.notifySubscribers(info);
        }
      }
    }
  }

  // custom cleanup - clear file watcher, cache, and subscriptions
  protected override onDispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }

    this.cache.clear();
    this.subscriptions.clear();
  }
}

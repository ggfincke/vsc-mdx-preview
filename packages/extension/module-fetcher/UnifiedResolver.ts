// packages/extension/module-fetcher/UnifiedResolver.ts
// unified module resolution combining framework aliases, TypeScript paths, and enhanced-resolve

import * as fs from 'fs';
import * as path from 'path';
import * as typescript from 'typescript';
import type { Resolver } from 'enhanced-resolve';
import { getBrowserResolver, getNodeResolver } from './resolver-factory';
import { resolveAlias, isBuiltInShim } from '../framework';
import { debug } from '../logging';

// import consolidated types from module-fetcher/types.ts
import type {
  TypeScriptConfiguration,
  ResolutionContext,
  ResolutionResult,
  ResolutionMode,
} from './types';

// re-export types for backward compatibility
export type {
  TypeScriptConfiguration,
  ResolutionContext,
  ResolutionResult,
  ResolutionMode,
};

// default extensions for file probing
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mdx', '.md'];
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// UnifiedResolver combines three resolution approaches:
// 1. Framework alias resolution (e.g., @theme/Tabs -> built-in shim)
// 2. TypeScript path resolution (via tsconfig paths)
// 3. enhanced-resolve (for node_modules w/ ESM exports support)
// 4. File probing fallback (for relative imports)
export class UnifiedResolver {
  private browserResolver: Resolver;
  private nodeResolver: Resolver;

  constructor() {
    this.browserResolver = getBrowserResolver();
    this.nodeResolver = getNodeResolver();
  }

  // check if specifier is a relative import
  isRelativeImport(specifier: string): boolean {
    return specifier.startsWith('./') || specifier.startsWith('../');
  }

  // check if specifier should be resolved (not a URL or npm: protocol)
  shouldResolve(specifier: string): boolean {
    if (!specifier) return false;
    if (specifier.startsWith('http://') || specifier.startsWith('https://'))
      return false;
    if (specifier.startsWith('npm://')) return false;
    return true;
  }

  // synchronous resolution
  resolveSync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode = 'dependency'
  ): ResolutionResult | null {
    if (!this.shouldResolve(specifier)) {
      return null;
    }

    // Step 1: Framework alias resolution (for bare imports only)
    if (
      context.framework &&
      context.shimsEnabled &&
      !this.isRelativeImport(specifier)
    ) {
      const aliasedPath = resolveAlias(
        specifier,
        context.framework,
        context.workspaceRoot ?? context.baseDir
      );

      if (aliasedPath !== null) {
        if (isBuiltInShim(aliasedPath)) {
          debug(
            `[UNIFIED-RESOLVER] Framework shim: ${specifier} -> ${aliasedPath}`
          );
          return { fsPath: aliasedPath, isBuiltInShim: true, specifier };
        }
        // alias resolved to a path - continue with that path
        debug(
          `[UNIFIED-RESOLVER] Framework alias: ${specifier} -> ${aliasedPath}`
        );
        specifier = aliasedPath;
      }
    }

    // Step 2: TypeScript path resolution (for non-relative imports)
    if (context.tsConfig && !this.isRelativeImport(specifier)) {
      const tsResolved = this.resolveWithTypeScript(specifier, context);
      if (tsResolved) {
        debug(`[UNIFIED-RESOLVER] TypeScript: ${specifier} -> ${tsResolved}`);
        return { fsPath: tsResolved, isBuiltInShim: false, specifier };
      }
    }

    // Step 3: enhanced-resolve (for node_modules)
    if (!this.isRelativeImport(specifier)) {
      const resolver =
        mode === 'node' ? this.nodeResolver : this.browserResolver;
      try {
        const resolved = resolver.resolveSync({}, context.baseDir, specifier);
        if (resolved) {
          debug(
            `[UNIFIED-RESOLVER] enhanced-resolve: ${specifier} -> ${resolved}`
          );
          return { fsPath: resolved, isBuiltInShim: false, specifier };
        }
      } catch {
        // continue to fallback
      }
    }

    // Step 4: File probing fallback (for relative imports)
    if (this.isRelativeImport(specifier)) {
      const probed = this.probeFileSync(context.baseDir, specifier);
      if (probed) {
        debug(`[UNIFIED-RESOLVER] File probe: ${specifier} -> ${probed}`);
        return { fsPath: probed, isBuiltInShim: false, specifier };
      }
    }

    debug(
      `[UNIFIED-RESOLVER] Could not resolve: ${specifier} from ${context.baseDir}`
    );
    return null;
  }

  // asynchronous resolution (delegates to sync for now)
  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    mode: ResolutionMode = 'dependency'
  ): Promise<ResolutionResult | null> {
    // enhanced-resolve is sync anyway, so just delegate
    return this.resolveSync(specifier, context, mode);
  }

  // resolve using TypeScript
  private resolveWithTypeScript(
    specifier: string,
    context: ResolutionContext
  ): string | null {
    if (!context.tsConfig) return null;

    const { tsCompilerOptions, tsCompilerHost } = context.tsConfig;
    const containingFile = path.join(context.baseDir, 'index.ts'); // virtual file

    const resolvedModule = typescript.resolveModuleName(
      specifier,
      containingFile,
      tsCompilerOptions,
      tsCompilerHost
    ).resolvedModule;

    if (resolvedModule) {
      const fsPath = resolvedModule.resolvedFileName;
      // skip .d.ts files
      if (fsPath.endsWith('.d.ts')) {
        return null;
      }
      return fsPath;
    }

    return null;
  }

  // probe for file with extensions
  private probeFileSync(baseDir: string, specifier: string): string | null {
    const resolved = path.resolve(baseDir, specifier);

    // skip node_modules
    if (resolved.includes('node_modules')) {
      return null;
    }

    // check exact path
    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // continue
    }

    // try with extensions
    for (const ext of DEFAULT_EXTENSIONS) {
      const fullPath = resolved + ext;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          return fullPath;
        }
      } catch {
        // continue
      }
    }

    // try index files
    for (const ext of INDEX_EXTENSIONS) {
      const indexPath = path.join(resolved, `index${ext}`);
      try {
        const stat = fs.statSync(indexPath);
        if (stat.isFile()) {
          return indexPath;
        }
      } catch {
        // continue
      }
    }

    return null;
  }
}

// singleton instance
let resolverInstance: UnifiedResolver | null = null;

// get the shared UnifiedResolver instance
export function getUnifiedResolver(): UnifiedResolver {
  if (!resolverInstance) {
    resolverInstance = new UnifiedResolver();
  }
  return resolverInstance;
}

// reset resolver (for testing)
export function resetUnifiedResolver(): void {
  resolverInstance = null;
}

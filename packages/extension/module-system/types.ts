// packages/extension/module-system/types.ts
// consolidated type definitions for the module system

import type { FrameworkId, FetchResult } from '@mdx-preview/shared';

// re-export shared types
// Framework is aliased to FrameworkId for backward compatibility
export type { FetchResult };
export type Framework = FrameworkId;

// typescript configuration for module resolution (extracted from tsconfig.json)
// uses lightweight tsconfck parsing instead of full TypeScript compiler
export interface TypeScriptConfiguration {
  // base URL for non-relative imports (from compilerOptions.baseUrl)
  baseUrl?: string;
  // path alias mappings (from compilerOptions.paths)
  paths?: Record<string, string[]>;
  // root directory (from compilerOptions.rootDir)
  rootDir?: string;
  // absolute path to the tsconfig.json file
  configPath?: string;
}

// context for resolving imports
export interface ResolutionContext {
  // base directory for relative imports
  baseDir: string;
  // typescript configuration (optional)
  tsConfig?: TypeScriptConfiguration;
  // detected framework (optional)
  framework?: Framework;
  // workspace root (optional, for alias resolution)
  workspaceRoot?: string;
  // whether framework shims are enabled
  shimsEnabled?: boolean;
}

// result of a successful resolution
export interface ResolutionResult {
  // absolute filesystem path
  fsPath: string;
  // true if this resolved to a built-in shim (webview has it preloaded)
  isBuiltInShim: boolean;
  // original import specifier
  specifier: string;
  // resolution strategy that succeeded (optional for backward compatibility)
  strategy?: ResolutionStrategy;
}

// resolution mode for different contexts
export type ResolutionMode = 'browser' | 'node' | 'dependency';

// resolution strategy enum - indicates which approach succeeded
export enum ResolutionStrategy {
  FrameworkShim = 'framework-shim',
  FrameworkAlias = 'framework-alias',
  TypeScript = 'typescript',
  EnhancedResolve = 'enhanced-resolve',
  FileProbe = 'file-probe',
}


// packages/extension-host/src/features/module-runtime/types/module-system.ts
// type definitions for the module system

import type { FetchResult, FrameworkId } from '@mdx-preview/contracts';

// re-export shared types
export type { FetchResult, FrameworkId };

// typescript configuration for module resolution (extracted from tsconfig.json)
// use lightweight get-tsconfig parsing instead of full TypeScript compiler
export interface TypeScriptConfiguration {
  // base URL
  baseUrl?: string;
  // path aliases
  paths?: Record<string, string[]>;
  // root directory
  rootDir?: string;
  // tsconfig path
  configPath?: string;
}

// context for resolving imports
export interface ResolutionContext {
  // base directory
  baseDir: string;
  // typescript config
  tsConfig?: TypeScriptConfiguration;
  // detected framework
  framework?: FrameworkId;
  // workspace root
  workspaceRoot?: string;
  // shims enabled
  shimsEnabled?: boolean;
}

// result of a successful resolution
export interface ResolutionResult {
  // filesystem path
  fsPath: string;
  // built-in shim flag
  isBuiltInShim: boolean;
  // import specifier
  specifier: string;
  // resolution strategy
  strategy?: ResolutionStrategy;
}

// resolution mode for different contexts
export type ResolutionMode = 'browser' | 'node' | 'dependency';

// resolution strategy enum - indicates which approach succeeded
export enum ResolutionStrategy {
  FrameworkShim = 'framework-shim',
  TypeScript = 'typescript',
  EnhancedResolve = 'enhanced-resolve',
  FileProbe = 'file-probe',
}

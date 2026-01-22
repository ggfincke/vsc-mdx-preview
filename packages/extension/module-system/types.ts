// packages/extension/module-system/types.ts
// consolidated type definitions for the module system

import type * as typescript from 'typescript';
import type { Framework } from '../framework/FrameworkDetector';

// re-export shared types
export type { FetchResult } from '@mdx-preview/shared';
export type { Framework };

// typescript configuration for module resolution (compiler options & host)
export interface TypeScriptConfiguration {
  tsCompilerOptions: typescript.CompilerOptions;
  tsCompilerHost: typescript.CompilerHost;
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


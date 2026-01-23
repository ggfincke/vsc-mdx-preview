// packages/webview-app/src/module-system/index.ts
// main entry point - exports & high-level API for Trusted Mode module loading

import { ComponentType } from 'react';
import { registry } from './registry/ModuleRegistry';
import { clearInjectedStyles } from './styles/injectStyles';
import { loadModule } from './loader/loadModule';
import {
  initPreloadedModules,
  fallbackLayoutModule,
  getPreservedIds,
  ensureFrameworkShims,
  ensureGenericShims,
} from './preload';
import type { Framework } from '@mdx-preview/shared';
import type { FetchResult } from './types';
import { ExtensionHandle } from '../rpc-webview';

// Re-exports for external use
export { registry } from './registry/ModuleRegistry';
export { clearInjectedStyles } from './styles/injectStyles';
export { loadModule } from './loader/loadModule';
export type { FetchResult, Module, ModuleRuntime } from './types';

// State
let preloadedModulesInitialized = false;
let vscodeMarkdownLayoutModule: unknown = null;
let pendingFrameworkShimLoad: Promise<void> | null = null;
let pendingGenericShimLoad: Promise<void> | null = null;

// set the vscode-markdown-layout module - called from App.tsx if the module is available
export function setVscodeMarkdownLayout(module: unknown): void {
  vscodeMarkdownLayoutModule = module;
}

// ensure preloaded modules are initialized - called internally before any module loading
function ensurePreloadedModules(): void {
  if (preloadedModulesInitialized) {
    return;
  }

  // initialize w/ layout module if available, otherwise use fallback
  if (vscodeMarkdownLayoutModule) {
    initPreloadedModules(registry, vscodeMarkdownLayoutModule);
  } else {
    initPreloadedModules(registry, fallbackLayoutModule);
  }
  preloadedModulesInitialized = true;
}

// Track last entry path for incremental invalidation
let lastEntryPath: string | null = null;

// clear all modules except preloaded ones - called when entry file changes to ensure fresh state
export function resetModules(): void {
  registry.clearNonPreloaded(getPreservedIds());
  clearInjectedStyles();
}

// clear dependency graph but keep module cache - called at start of each evaluation to rebuild dependency graph
export function resetDependencies(): void {
  registry.clearDependencies();
}

// invalidate a specific module (for hot reload)
export function invalidateModule(id: string): void {
  registry.invalidate(id);
}

// invalidate a module & all modules that depend on it - returns the set of invalidated module IDs
export function invalidateModuleWithDependents(id: string): Set<string> {
  return registry.invalidateWithDependents(id);
}

// load framework-specific shims on demand - called by RPC handler when extension sends framework info
export function ensureFrameworkShimsLoaded(framework: Framework): void {
  // ensure preloaded modules are ready first
  ensurePreloadedModules();
  // store the promise so evaluateModuleToComponent can await it
  pendingFrameworkShimLoad = ensureFrameworkShims(registry, framework);
}

// load specific generic shims on demand - called by RPC handler for conditional preloading
export function ensureGenericShimsLoaded(components: string[]): void {
  // ensure preloaded modules are ready first
  ensurePreloadedModules();
  // store the promise so evaluateModuleToComponent can await it
  // this fixes the race condition where setUsedComponents is called right before updatePreview
  pendingGenericShimLoad = ensureGenericShims(registry, components);
}

// RPC fetcher that delegates to extension via Comlink
async function rpcFetcher(
  request: string,
  isBare: boolean,
  parentId: string
): Promise<FetchResult | undefined> {
  return ExtensionHandle.fetch(request, isBare, parentId);
}

// evaluate MDX code & return a React component - main entry point for Trusted Mode rendering
// uses incremental invalidation: only clears modules when entry file changes
// on subsequent evaluations of the same entry, only the entry module & its
// dependents are invalidated, preserving cached dependencies for better perf
export async function evaluateModuleToComponent(
  code: string,
  entryFilePath: string,
  dependencies: string[]
): Promise<ComponentType> {
  // Ensure preloaded modules are ready
  ensurePreloadedModules();

  // Wait for any pending generic shim loading to complete
  // This fixes the race condition where setUsedComponents is called right before updatePreview
  if (pendingGenericShimLoad) {
    await pendingGenericShimLoad;
    pendingGenericShimLoad = null;
  }

  // Wait for any pending framework shim loading to complete
  // This fixes the race condition where setFramework is called right before updatePreview
  if (pendingFrameworkShimLoad) {
    await pendingFrameworkShimLoad;
    pendingFrameworkShimLoad = null;
  }

  // Determine if we need full reset or incremental invalidation
  if (lastEntryPath !== entryFilePath) {
    // Entry file changed - full reset required
    resetModules();
    lastEntryPath = entryFilePath;
  } else {
    // Same entry file - incremental invalidation
    // invalidate entry & all modules that depend on it
    registry.invalidateWithDependents(entryFilePath);
    // Clear dependency graph (will be rebuilt during load)
    resetDependencies();
    // Clear injected styles (will be re-injected)
    clearInjectedStyles();
  }

  // load the entry module & all dependencies
  const module = await loadModule(
    entryFilePath,
    code,
    dependencies,
    rpcFetcher
  );

  // Get the default export (MDX component)
  const component = module.exports?.default || module.exports;

  if (typeof component !== 'function') {
    throw new Error(
      `MDX module did not export a valid component. ` +
        `Got: ${typeof component}. ` +
        `Make sure the MDX file has valid content.`
    );
  }

  return component as ComponentType;
}

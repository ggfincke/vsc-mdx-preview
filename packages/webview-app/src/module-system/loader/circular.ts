// packages/webview-app/src/module-system/loader/circular.ts
// Circular dependency detection and handling
//
// When modules have circular dependencies (A imports B, B imports A),
// we use pending promise tracking to prevent infinite recursion.
// If a module is already being loaded (pending), we return the in-flight
// promise instead of starting a new load.

import { registry } from '../registry/ModuleRegistry';
import type { Module } from '../types';

/**
 * Check if a module is currently being loaded.
 * Returns the pending promise if the module is in-flight, preventing circular recursion.
 *
 * @param id - Module identifier
 * @returns Pending promise if module is currently loading, undefined otherwise
 */
export function getPendingModule(id: string): Promise<Module> | undefined {
  return registry.getPending(id);
}

/**
 * Register a module as pending (currently being loaded).
 * This enables cycle detection for recursive dependency chains.
 *
 * @param id - Module identifier
 * @param promise - Promise for the loading module
 */
export function registerPendingModule(
  id: string,
  promise: Promise<Module>
): void {
  registry.setPending(id, promise);
}

/**
 * Clear a module from pending tracking.
 * Called when module loading completes (success or failure).
 *
 * @param id - Module identifier
 */
export function clearPendingModule(id: string): void {
  registry.clearPending(id);
}

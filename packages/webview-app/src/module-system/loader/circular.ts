// packages/webview-app/src/module-system/loader/circular.ts
// Circular dependency detection & handling

import { registry } from '../registry/ModuleRegistry';
import type { Module } from '../types';

// check if a module is currently being loaded
export function getPendingModule(id: string): Promise<Module> | undefined {
  return registry.getPending(id);
}

// register a module as pending (currently being loaded)
export function registerPendingModule(
  id: string,
  promise: Promise<Module>
): void {
  registry.setPending(id, promise);
}

// clear a module from pending tracking
export function clearPendingModule(id: string): void {
  registry.clearPending(id);
}

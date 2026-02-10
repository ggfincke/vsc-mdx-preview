import type { ModuleRegistry } from '../registry/ModuleRegistry';
import type { Framework, FrameworkId, PreloadEntry } from '../types';
import { PRELOADED_MODULE_IDS } from '../types';
import { preloadCoreModules } from './core';
import { configureModuleLoader } from '../internal/runtime-config';

export { fallbackLayoutModule } from './core';

// request-specifier -> canonical module ID
const PRELOAD_ALIASES: Record<string, string> = {};

// tracked shim IDs for reset preservation
const PRELOADED_SHIM_IDS: string[] = [];

const preloadEntriesById = new Map<string, PreloadEntry>();

function clearObject(target: Record<string, string>): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
}

function syncRuntimeAliases(): void {
  configureModuleLoader({ preloadAliases: { ...PRELOAD_ALIASES } });
}

function appendShimId(id: string): void {
  if (!PRELOADED_SHIM_IDS.includes(id)) {
    PRELOADED_SHIM_IDS.push(id);
  }
}

function addAliasesForEntry(entry: PreloadEntry): void {
  for (const alias of entry.aliases ?? []) {
    const existing = PRELOAD_ALIASES[alias];
    if (existing && existing !== entry.id) {
      throw new Error(
        `Alias collision for "${alias}": ${existing} vs ${entry.id}`
      );
    }
    PRELOAD_ALIASES[alias] = entry.id;
  }
}

function registerEntry(entry: PreloadEntry): void {
  preloadEntriesById.set(entry.id, entry);
  appendShimId(entry.id);
  addAliasesForEntry(entry);
}

export function setPreloadEntries(entries: readonly PreloadEntry[]): void {
  preloadEntriesById.clear();
  PRELOADED_SHIM_IDS.length = 0;
  clearObject(PRELOAD_ALIASES);

  for (const entry of entries) {
    registerEntry(entry);
  }

  syncRuntimeAliases();
}

export function registerPreloadEntries(
  registry: ModuleRegistry,
  entries: readonly PreloadEntry[]
): void {
  for (const entry of entries) {
    registerEntry(entry);
    registry.preload(entry.id, entry.exports);
  }

  syncRuntimeAliases();
}

export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  preloadCoreModules(
    registry,
    vscodeMarkdownLayout,
    Array.from(preloadEntriesById.values())
  );

  syncRuntimeAliases();
}

export async function ensureFrameworkShims(
  _registry: ModuleRegistry,
  _framework: FrameworkId
): Promise<void> {
  // framework-specific shim preloading is owned by host integration
}

export async function ensureGenericShims(
  _registry: ModuleRegistry,
  _components: string[]
): Promise<void> {
  // generic shim preloading is owned by host integration
}

export function getPreservedIds(): string[] {
  return Array.from(
    new Set([...Object.values(PRELOADED_MODULE_IDS), ...PRELOADED_SHIM_IDS])
  );
}

export function resetFrameworkState(): void {
  // no-op in standalone core package
}

export function resetGenericShimsState(): void {
  // no-op in standalone core package
}

export function getLastShimLoadResult(): {
  success: boolean;
  framework: Framework;
  failedShims: string[];
  usedFallback: boolean;
} | null {
  return null;
}

export function getLastGenericLoadResult(): {
  loaded: string[];
  failed: string[];
} | null {
  return null;
}

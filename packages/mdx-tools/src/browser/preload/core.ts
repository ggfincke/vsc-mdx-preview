import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { PRELOADED_MODULE_IDS, type PreloadEntry } from '../types';

export interface LayoutOptions {
  forceLightTheme?: boolean;
}

// fallback layout module when host does not preload a custom layout implementation
export const fallbackLayoutModule = {
  createLayout: (_options: LayoutOptions = {}) => {
    return ({ children }: { children?: unknown }) => children ?? null;
  },
};

// initialize core preloaded modules in the registry
export function preloadCoreModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown,
  entries: PreloadEntry[] = []
): void {
  for (const entry of entries) {
    registry.preload(entry.id, entry.exports);
  }

  if (!registry.has(PRELOADED_MODULE_IDS.vscodeLayout)) {
    registry.preload(PRELOADED_MODULE_IDS.vscodeLayout, vscodeMarkdownLayout);
  }
}

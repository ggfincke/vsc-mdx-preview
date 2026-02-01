// packages/webview-app/src/module-system/styles/injectStyles.ts
// CSS injection - handle injecting CSS from imported style files
//
// STYLE INJECTION ARCHITECTURE
// - ModuleRegistry: authoritative source of truth for style tracking
//   - has reference counting & lru eviction for style entries
//   - use hasInjectedStyle() to check before injection
//   - use markStyleInjected() to track after injection
//
// - StyleInjector: pure DOM manipulation layer
//   - handle <style> element creation & removal
//   - cache DOM references for O(1) removal
//   - does NOT track which styles have been injected (defer to registry)

import { registry } from '../registry/ModuleRegistry';
import { StyleInjector } from '../../utils/StyleInjector';

// inject CSS into the document for a module
// use ModuleRegistry as the authoritative tracker for deduplication,
// then delegate DOM operations to StyleInjector
export function injectStyles(id: string, css: string): void {
  // check registry (source of truth) to avoid duplicate injection
  if (registry.hasInjectedStyle(id)) {
    return;
  }

  // dom operation via StyleInjector
  StyleInjector.injectModuleCss(id, css);

  // track in registry (for module loading coordination + reference counting)
  registry.markStyleInjected(id);
}

// remove all injected module styles (called when preview is refreshed)
export function clearInjectedStyles(): void {
  // clear dom elements via StyleInjector
  StyleInjector.clear('modules');
  // clear registry tracking
  registry.clearInjectedStyles();
}

// remove styles for specific modules (for incremental updates)
export function removeStylesForModules(moduleIds: string[]): void {
  for (const id of moduleIds) {
    StyleInjector.removeModuleCss(id);
    registry.unmarkStyleInjected(id);
  }
}

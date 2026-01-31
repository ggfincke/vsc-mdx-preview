// packages/webview-app/src/module-system/styles/injectStyles.ts
// CSS injection - handles injecting CSS from imported style files
//
// STYLE INJECTION ARCHITECTURE:
// - ModuleRegistry: Authoritative source of truth for style tracking
//   - Has reference counting & LRU eviction for style entries
//   - Use hasInjectedStyle() to check before injection
//   - Use markStyleInjected() to track after injection
//
// - StyleInjector: Pure DOM manipulation layer
//   - Handles <style> element creation & removal
//   - Caches DOM references for O(1) removal
//   - Does NOT track which styles have been injected (defers to registry)

import { registry } from '../registry/ModuleRegistry';
import { StyleInjector } from '../../utils/StyleInjector';

// inject CSS into the document for a module
// uses ModuleRegistry as the authoritative tracker for deduplication,
// then delegates DOM operations to StyleInjector
export function injectStyles(id: string, css: string): void {
  // Check registry (source of truth) to avoid duplicate injection
  if (registry.hasInjectedStyle(id)) {
    return;
  }

  // DOM operation via StyleInjector
  StyleInjector.injectModuleCss(id, css);

  // Track in registry (for module loading coordination + reference counting)
  registry.markStyleInjected(id);
}

// remove all injected module styles (called when preview is refreshed)
export function clearInjectedStyles(): void {
  // Clear DOM elements via StyleInjector
  StyleInjector.clear('modules');
  // Clear registry tracking
  registry.clearInjectedStyles();
}

// remove styles for specific modules (for incremental updates)
export function removeStylesForModules(moduleIds: string[]): void {
  for (const id of moduleIds) {
    StyleInjector.removeModuleCss(id);
    registry.unmarkStyleInjected(id);
  }
}

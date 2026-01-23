// packages/webview-app/src/module-system/styles/injectStyles.ts
// CSS injection - handles injecting CSS from imported style files

import { registry } from '../registry/ModuleRegistry';
import { StyleInjector } from '../../utils/StyleInjector';

// inject CSS into the document
export function injectStyles(id: string, css: string): void {
  // don't inject the same styles twice (use registry for module loading state)
  if (registry.hasInjectedStyle(id)) {
    return;
  }

  // use StyleInjector for DOM operations
  StyleInjector.injectModuleCss(id, css);

  // track in registry (for module loading coordination)
  registry.markStyleInjected(id);
}

// remove all injected styles (called when preview is refreshed)
export function clearInjectedStyles(): void {
  // use StyleInjector for DOM cleanup
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

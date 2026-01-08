// packages/webview-app/src/module-loader/injectStyles.ts
// CSS injection - handles injecting CSS from imported style files

import { registry } from './ModuleRegistry';

// inject CSS into the document
export function injectStyles(id: string, css: string): void {
  // don't inject the same styles twice
  if (registry.hasInjectedStyle(id)) {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-module-id', id);
  style.textContent = css;
  document.head.appendChild(style);

  registry.markStyleInjected(id);
}

// remove all injected styles (called when preview is refreshed)
export function clearInjectedStyles(): void {
  const styles = document.querySelectorAll('style[data-module-id]');
  styles.forEach((style) => style.remove());
  registry.clearInjectedStyles();
}

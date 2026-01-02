/**
 * CSS Injection
 *
 * Handles injecting CSS from imported style files.
 */

import { registry } from './ModuleRegistry';

/**
 * Inject CSS into the document.
 *
 * @param id - The module ID (used for deduplication)
 * @param css - The CSS content to inject
 */
export function injectStyles(id: string, css: string): void {
  // Don't inject the same styles twice
  if (registry.hasInjectedStyle(id)) {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-module-id', id);
  style.textContent = css;
  document.head.appendChild(style);

  registry.markStyleInjected(id);
}

/**
 * Remove all injected styles.
 * Called when preview is refreshed.
 */
export function clearInjectedStyles(): void {
  const styles = document.querySelectorAll('style[data-module-id]');
  styles.forEach((style) => style.remove());
  registry.clearInjectedStyles();
}

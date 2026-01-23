// packages/webview-app/src/utils/katexLoader.ts
// lazy-load KaTeX CSS only when math content is detected
//
// KaTeX CSS (~115KB) is deferred from initial bundle load to improve startup
// time for documents without math expressions. CSS is loaded via dynamic import
// when math content is detected.

// State: null = not started, Promise = loading, true = loaded, false = failed
let katexCssState: Promise<void> | boolean | null = null;

/**
 * Load KaTeX CSS (idempotent - safe to call multiple times)
 * Returns a promise that resolves when CSS is loaded.
 * Callers can optionally await, or call fire-and-forget (backward compatible).
 */
export function loadKatexCss(): Promise<void> {
  // Already loaded successfully
  if (katexCssState === true) {
    return Promise.resolve();
  }

  // Loading in progress - return existing promise (deduplicates concurrent calls)
  if (katexCssState instanceof Promise) {
    return katexCssState;
  }

  // Failed previously or not started - (re)try
  katexCssState = import('katex/dist/katex.min.css')
    .then(() => {
      katexCssState = true;
    })
    .catch((error) => {
      console.error('[KATEX] Failed to load KaTeX CSS:', error);
      katexCssState = false; // Allow retry on next call
      throw error; // Re-throw for callers who await
    });

  return katexCssState;
}

/**
 * Check if KaTeX CSS has been loaded successfully.
 */
export function isKatexCssLoaded(): boolean {
  return katexCssState === true;
}

/**
 * Check if KaTeX CSS loading is in progress.
 */
export function isKatexCssLoading(): boolean {
  return katexCssState instanceof Promise;
}

/**
 * Reset state (for testing only).
 */
export function resetKatexLoader(): void {
  katexCssState = null;
}

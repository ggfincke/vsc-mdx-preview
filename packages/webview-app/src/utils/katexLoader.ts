// packages/webview-app/src/utils/katexLoader.ts
// lazy-load KaTeX CSS only when math content is detected
//
// KaTeX CSS (~115KB) is deferred from initial bundle load to improve startup
// time for documents without math expressions. CSS is loaded via dynamic import
// when math content is detected.

// State: null = not started, Promise = loading, true = loaded, false = failed
let katexCssState: Promise<void> | boolean | null = null;

// load KaTeX CSS (idempotent)
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
      // allow retry on next call
      katexCssState = false;
      // re-throw for callers who await
      throw error;
    });

  return katexCssState;
}

// check if KaTeX CSS has been loaded successfully
export function isKatexCssLoaded(): boolean {
  return katexCssState === true;
}

// check if KaTeX CSS loading is in progress
export function isKatexCssLoading(): boolean {
  return katexCssState instanceof Promise;
}

// reset state (for testing)
export function resetKatexLoader(): void {
  katexCssState = null;
}

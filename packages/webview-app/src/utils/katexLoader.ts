// packages/webview-app/src/utils/katexLoader.ts
// lazy-load KaTeX CSS only when math content is detected
//
// KaTeX CSS (~115KB) is deferred from initial bundle load to improve startup
// time for documents without math expressions. CSS is loaded synchronously
// via dynamic import when math content is detected.

let katexCssLoaded = false;

// load KaTeX CSS (idempotent - safe to call multiple times)
export function loadKatexCss(): void {
  if (katexCssLoaded) {
    return;
  }
  katexCssLoaded = true;

  // dynamic import of CSS (Vite handles this as a side-effect import)
  import('katex/dist/katex.min.css');
}

// check if KaTeX CSS has been loaded (for testing/debugging)
export function isKatexCssLoaded(): boolean {
  return katexCssLoaded;
}

// reset state (for testing only)
export function resetKatexLoader(): void {
  katexCssLoaded = false;
}

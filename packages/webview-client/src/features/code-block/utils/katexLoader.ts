// packages/webview-client/src/features/code-block/utils/katexLoader.ts
// lazy-load KaTeX CSS only when math content is detected
// defer 115KB CSS through idempotent resource loader for faster startup

import { createResourceLoader } from '../../../shared/utils/createResourceLoader';

const loader = createResourceLoader(
  () => import('katex/dist/katex.min.css').then(() => undefined),
  { name: 'KATEX', allowRetry: true }
);

// load KaTeX CSS (idempotent)
export function loadKatexCss(): Promise<void> {
  return loader.load();
}

// check if KaTeX CSS has been loaded successfully
export function isKatexCssLoaded(): boolean {
  return loader.isLoaded();
}

// check if KaTeX CSS loading is in progress
export function isKatexCssLoading(): boolean {
  return loader.isLoading();
}

// reset state (for testing)
export function resetKatexLoader(): void {
  loader.reset();
}

// packages/webview-client/src/features/diagrams/utils/mermaidLoader.ts
// canonical lazy loader for Mermaid module

import {
  createLazyValueLoader,
  type LazyValueLoader,
} from '@mdx-preview/runtime-utils';

export type MermaidModule = typeof import('mermaid');

export function createMermaidLoader(
  loadFn: () => Promise<MermaidModule> = () => import('mermaid')
): LazyValueLoader<MermaidModule> {
  return createLazyValueLoader(loadFn, {
    allowRetry: true,
  });
}

const mermaidLoader = createMermaidLoader();

export function loadMermaid(): Promise<MermaidModule> {
  return mermaidLoader.load();
}

export function resetMermaidLoader(): void {
  mermaidLoader.reset();
}

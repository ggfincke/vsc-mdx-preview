// packages/webview-client/src/features/diagrams/utils/mermaidLoader.ts
// canonical lazy loader for Mermaid module

import { createLazyValueLoader } from '@mdx-preview/runtime-utils';

export type MermaidModule = typeof import('mermaid');

const mermaidLoader = createLazyValueLoader(() => import('mermaid'), {
  allowRetry: true,
});

export function loadMermaid(): Promise<MermaidModule> {
  return mermaidLoader.load();
}

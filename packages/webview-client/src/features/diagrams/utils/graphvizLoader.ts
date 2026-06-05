// packages/webview-client/src/features/diagrams/utils/graphvizLoader.ts
// canonical lazy loader for Graphviz WASM instance

import { createLazyValueLoader } from '@mdx-preview/runtime-utils';

type VizModule = typeof import('@viz-js/viz');
export type VizInstance = Awaited<ReturnType<VizModule['instance']>>;

const graphvizLoader = createLazyValueLoader(
  async () => {
    const mod = await import('@viz-js/viz');
    return mod.instance();
  },
  {
    allowRetry: true,
  }
);

export function loadGraphvizInstance(): Promise<VizInstance> {
  return graphvizLoader.load();
}

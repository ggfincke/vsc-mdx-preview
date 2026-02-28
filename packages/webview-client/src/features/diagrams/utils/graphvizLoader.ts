// packages/webview-client/src/features/diagrams/utils/graphvizLoader.ts
// canonical lazy loader for Graphviz WASM instance

import {
  createLazyValueLoader,
  type LazyValueLoader,
} from '@mdx-preview/runtime-utils';

type VizModule = typeof import('@viz-js/viz');
export type VizInstance = Awaited<ReturnType<VizModule['instance']>>;

export function createGraphvizLoader(
  loadModule: () => Promise<VizModule> = () => import('@viz-js/viz')
): LazyValueLoader<VizInstance> {
  return createLazyValueLoader(
    async () => {
      const mod = await loadModule();
      return mod.instance();
    },
    {
      allowRetry: true,
    }
  );
}

const graphvizLoader = createGraphvizLoader();

export function loadGraphvizInstance(): Promise<VizInstance> {
  return graphvizLoader.load();
}

export function resetGraphvizLoader(): void {
  graphvizLoader.reset();
}

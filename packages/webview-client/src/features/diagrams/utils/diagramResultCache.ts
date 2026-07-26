// packages/webview-client/src/features/diagrams/utils/diagramResultCache.ts
// bounded per-adapter cache for completed & in-flight diagram renders

import { LRUCache } from '@mdx-preview/runtime-utils';

// each adapter retains at most 50 completed diagrams; in-flight work is deduped separately
const MAX_RESULTS_PER_ADAPTER = 50;

interface AdapterCache {
  results: LRUCache<string, string>;
  inFlight: Map<string, Promise<string>>;
}

const adapterCaches = new Map<string, AdapterCache>();

function getAdapterCache(adapter: string): AdapterCache {
  const existing = adapterCaches.get(adapter);
  if (existing) {
    return existing;
  }

  const created: AdapterCache = {
    results: new LRUCache({ maxEntries: MAX_RESULTS_PER_ADAPTER }),
    inFlight: new Map(),
  };
  adapterCaches.set(adapter, created);
  return created;
}

export async function getDiagramResult(
  adapter: string,
  key: string,
  render: () => Promise<string>,
  sanitize?: (result: string) => string
): Promise<string> {
  const cache = getAdapterCache(adapter);
  const cached = cache.results.get(key);
  if (cached !== null) {
    return cached;
  }

  const existing = cache.inFlight.get(key);
  if (existing) {
    return existing;
  }

  const pending = Promise.resolve()
    .then(render)
    .then((result) => {
      const processed = sanitize ? sanitize(result) : result;
      cache.results.set(key, processed);
      return processed;
    });
  cache.inFlight.set(key, pending);

  try {
    return await pending;
  } finally {
    if (cache.inFlight.get(key) === pending) {
      cache.inFlight.delete(key);
    }
  }
}

// reset module state between isolated webview tests
export function resetDiagramResultCache(): void {
  adapterCaches.clear();
}

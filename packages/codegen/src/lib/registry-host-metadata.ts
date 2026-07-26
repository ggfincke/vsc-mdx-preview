// packages/codegen/src/lib/registry-host-metadata.ts
// compute host-specific preload IDs from registry entries

import type { ComponentRegistryEntry } from 'mdx-forge/components/registry';

// compute host-specific preload ID from registry entry
// pattern: npm://@mdx-preview/shims-{framework}/{name}
export function buildPreloadId(entry: ComponentRegistryEntry): string {
  return `npm://@mdx-preview/shims-${entry.framework}/${entry.name}`;
}

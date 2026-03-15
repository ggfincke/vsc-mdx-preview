// packages/codegen/src/lib/registry-host-metadata.ts
// compute host-specific preloadId & webviewImport from registry entries

import type { ComponentRegistryEntry } from 'mdx-forge/components/registry';

// compute host-specific preload ID from registry entry
// pattern: npm://@mdx-preview/shims-{framework}/{name}
export function buildPreloadId(entry: ComponentRegistryEntry): string {
  return `npm://@mdx-preview/shims-${entry.framework}/${entry.name}`;
}

// compute host-specific webview import path from registry entry
// all shim entries use features/shims/{framework}/... which gets mapped
// to mdx-forge/components/{framework} by getRelativeWebviewImport()
export function buildWebviewImport(entry: ComponentRegistryEntry): string {
  if (entry.kind === 'barrel') {
    return `features/shims/${entry.framework}`;
  }
  return `features/shims/${entry.framework}/${entry.name}`;
}

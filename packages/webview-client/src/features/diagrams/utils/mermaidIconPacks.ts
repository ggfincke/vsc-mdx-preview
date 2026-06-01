// packages/webview-client/src/features/diagrams/utils/mermaidIconPacks.ts
// register icon packs for mermaid architecture diagrams

import type { ResolvedMermaidIconPack } from '@mdx-preview/contracts';
import logosIcons from '@iconify-json/logos/icons.json';
import type { MermaidModule } from './mermaidLoader';

// bundled "logos" pack includes AWS service logos (logos:aws-lambda etc)
// loaded locally (not via CDN) so it works offline & under the webview CSP
let builtinRegistered = false;

// names of dynamic packs already registered (avoid redundant re-registration)
const registeredDynamicPacks = new Set<string>();

// latest dynamic packs pushed from the host (read by the renderer at render time)
let pendingDynamicPacks: ResolvedMermaidIconPack[] = [];

// store the latest dynamic packs (called by the theme-value hook)
export function setPendingDynamicPacks(packs: ResolvedMermaidIconPack[]): void {
  pendingDynamicPacks = packs;
}

// get the latest dynamic packs
export function getPendingDynamicPacks(): ResolvedMermaidIconPack[] {
  return pendingDynamicPacks;
}

// register the bundled builtin icon pack on the given mermaid instance
export function registerBuiltinIconPacks(mermaid: MermaidModule): void {
  if (builtinRegistered) {
    return;
  }
  mermaid.default.registerIconPacks([
    {
      name: 'logos',
      loader: () => logosIcons,
    },
  ]);
  builtinRegistered = true;
}

// register user-configured icon packs pushed from the extension host
// each pack is registered once by name (mermaid stores packs by name)
export function registerDynamicIconPacks(
  mermaid: MermaidModule,
  packs: ResolvedMermaidIconPack[]
): void {
  for (const pack of packs) {
    if (!pack || !pack.name || registeredDynamicPacks.has(pack.name)) {
      continue;
    }
    mermaid.default.registerIconPacks([
      {
        name: pack.name,
        loader: () => pack.icons as never,
      },
    ]);
    registeredDynamicPacks.add(pack.name);
  }
}

// reset guards (used by tests & module-cache resets)
export function resetMermaidIconPacks(): void {
  builtinRegistered = false;
  registeredDynamicPacks.clear();
  pendingDynamicPacks = [];
}

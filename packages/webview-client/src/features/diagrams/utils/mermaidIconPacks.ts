// packages/webview-client/src/features/diagrams/utils/mermaidIconPacks.ts
// register icon packs for mermaid architecture diagrams

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import type {
  IconifyIcon,
  IconifyIconPack,
  ResolvedMermaidIconPack,
} from '@mdx-preview/contracts';
import logosIcons from '@iconify-json/logos/icons.json';
import type { MermaidModule } from './mermaidLoader';

// re-sanitize icon bodies in the webview — never trust host RPC data blindly.
// forbid external-resource elements/attrs so a malicious pack can't beacon out
// under the webview CSP (img-src allows https:)
const ICON_BODY_PURIFY_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: [
    'image',
    'feImage',
    'foreignObject',
    'script',
    'a',
    'use',
    'style',
  ],
  // style is dropped too: DOMPurify does not sanitize CSS, so a url() inside it
  // would survive as an external-resource beacon under img-src https:
  FORBID_ATTR: ['href', 'xlink:href', 'style'],
};

// sanitize one icon body. wrap in <svg> so DOMPurify parses the fragment in SVG
// context (bare svg children parsed as HTML get mangled/dropped), then extract
// the sanitized inner markup
function sanitizeIconBody(body: string): string {
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const clean = DOMPurify.sanitize(wrapped, ICON_BODY_PURIFY_CONFIG) as string;
  const inner = /<svg\b[^>]*>([\s\S]*)<\/svg>/i.exec(clean);
  return inner ? inner[1] : '';
}

// 'logos' is the builtin; user pack names must be a simple prefix token
const DYNAMIC_PACK_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;

// strip dangerous markup from each icon body before registering
// treat the host payload as untrusted RPC data, not the declared type
function sanitizeIconPack(
  pack: ResolvedMermaidIconPack
): IconifyIconPack | null {
  const source = pack.icons as unknown;
  if (!source || typeof source !== 'object') {
    return null;
  }
  const iconMap = (source as { icons?: unknown }).icons;
  if (!iconMap || typeof iconMap !== 'object') {
    return null;
  }
  const icons: Record<string, IconifyIcon> = {};
  for (const [key, value] of Object.entries(
    iconMap as Record<string, unknown>
  )) {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof (value as { body?: unknown }).body !== 'string'
    ) {
      continue;
    }
    const icon = value as IconifyIcon;
    icons[key] = {
      ...icon,
      body: sanitizeIconBody(icon.body),
    };
  }
  if (Object.keys(icons).length === 0) {
    return null;
  }
  return { ...(source as IconifyIconPack), icons };
}

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
    // reject the reserved builtin name & any non-prefix-token name
    if (pack.name === 'logos' || !DYNAMIC_PACK_NAME_RE.test(pack.name)) {
      continue;
    }
    const safe = sanitizeIconPack(pack);
    if (!safe) {
      continue;
    }
    mermaid.default.registerIconPacks([
      {
        name: pack.name,
        loader: () => safe as never,
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

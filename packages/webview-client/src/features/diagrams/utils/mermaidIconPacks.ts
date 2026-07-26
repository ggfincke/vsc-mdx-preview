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

// re-sanitize icon bodies in the webview — never trust host RPC data blindly
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
  // style is dropped too — DOMPurify doesn't sanitize CSS, so a url() in a style
  // attr would survive as an external-resource beacon under img-src
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

// content fingerprints of dynamic packs already registered by name
const registeredDynamicPacks = new Map<string, string>();

// latest dynamic packs pushed from the host (read by the renderer at render time)
let pendingDynamicPacks: ResolvedMermaidIconPack[] = [];

const fingerprintCache = new WeakMap<object, string>();

function getContentFingerprint(value: object): string {
  const cached = fingerprintCache.get(value);
  if (cached) {
    return cached;
  }

  const serialized = JSON.stringify(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < serialized.length; i++) {
    const code = serialized.charCodeAt(i);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  const fingerprint = `${serialized.length}:${(first >>> 0).toString(16)}:${(
    second >>> 0
  ).toString(16)}`;
  fingerprintCache.set(value, fingerprint);
  return fingerprint;
}

// store the latest dynamic packs (called by the theme-value hook)
export function setPendingDynamicPacks(packs: ResolvedMermaidIconPack[]): void {
  pendingDynamicPacks = packs;
}

// get the latest dynamic packs
export function getPendingDynamicPacks(): ResolvedMermaidIconPack[] {
  return pendingDynamicPacks;
}

// compact the complete pack payload into a stable content fingerprint
export function getMermaidIconPacksFingerprint(
  packs: ResolvedMermaidIconPack[]
): string {
  return getContentFingerprint(packs);
}

// register the bundled builtin icon pack on the given mermaid instance
export function registerBuiltinIconPacks(mermaid: MermaidModule): void {
  if (builtinRegistered) {
    return;
  }
  mermaid.default.registerIconPacks([
    {
      name: 'logos',
      loader: async () => logosIcons,
    },
  ]);
  builtinRegistered = true;
}

// register user-configured icon packs pushed from the extension host
// skip only unchanged name/content pairs so edited packs replace stored data
export function registerDynamicIconPacks(
  mermaid: MermaidModule,
  packs: ResolvedMermaidIconPack[]
): void {
  for (const pack of packs) {
    if (!pack || !pack.name) {
      continue;
    }
    // reject the reserved builtin name & any non-prefix-token name
    if (pack.name === 'logos' || !DYNAMIC_PACK_NAME_RE.test(pack.name)) {
      continue;
    }
    const fingerprint = getContentFingerprint(pack);
    if (registeredDynamicPacks.get(pack.name) === fingerprint) {
      continue;
    }
    const safe = sanitizeIconPack(pack);
    if (!safe) {
      continue;
    }
    mermaid.default.registerIconPacks([
      {
        name: pack.name,
        icons: { ...safe, prefix: pack.name } as never,
      },
    ]);
    registeredDynamicPacks.set(pack.name, fingerprint);
  }
}

// reset guards (used by tests & module-cache resets)
export function resetMermaidIconPacks(): void {
  builtinRegistered = false;
  registeredDynamicPacks.clear();
  pendingDynamicPacks = [];
}

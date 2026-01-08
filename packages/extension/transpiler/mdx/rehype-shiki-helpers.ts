// packages/extension/transpiler/mdx/rehype-shiki-helpers.ts
// helpers for rehype-shiki: HTML->HAST parsing & style normalization

import type { ElementContent, Root } from 'hast';
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';

export type StyleObject = Record<string, string>;

// convert CSS style string to React-friendly object
// handle camelCase conversion & CSS custom properties (--var)
export function styleStringToObject(style: string): StyleObject {
  const out: StyleObject = {};

  for (const chunk of style.split(';')) {
    const i = chunk.indexOf(':');
    if (i === -1) {
      continue;
    }

    const rawKey = chunk.slice(0, i).trim();
    const rawVal = chunk.slice(i + 1).trim();
    if (!rawKey || !rawVal) {
      continue;
    }

    // preserve CSS custom properties, camelCase regular props
    const key = rawKey.startsWith('--')
      ? rawKey
      : rawKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    out[key] = rawVal;
  }

  return out;
}

// parse HTML string into HAST fragment
// ! keep styles as strings for rehype-stringify compatibility
export function htmlToHastFragment(html: string): ElementContent[] {
  const root = fromHtmlIsomorphic(html, { fragment: true }) as unknown as Root;
  return root.children as ElementContent[];
}

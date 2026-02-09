// packages/extension/compiler/shared/rehype/shiki-helpers.ts
// helpers for rehype-shiki: HTML->HAST parsing

import type { ElementContent, Root } from 'hast';
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';

// parse HTML string into HAST fragment
// ! keep styles as strings for rehype-stringify compatibility
export function htmlToHastFragment(html: string): ElementContent[] {
  const root = fromHtmlIsomorphic(html, { fragment: true }) as unknown as Root;
  return root.children as ElementContent[];
}

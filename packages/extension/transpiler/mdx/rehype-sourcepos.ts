// packages/extension/transpiler/mdx/rehype-sourcepos.ts
// rehype plugin to add data-sourcepos attributes for scroll sync

import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

// block-level elements that should get sourcepos
const BLOCK_ELEMENTS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'table',
  'hr',
  'div',
]);

// add data-sourcepos="startLine:startCol-endLine:endCol" to block elements
// line numbers are 1-based (from unified/remark)
export default function rehypeSourcepos() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      // only add to block-level elements w/ position info
      if (!BLOCK_ELEMENTS.has(node.tagName) || !node.position) {
        return;
      }

      const { start, end } = node.position;

      // validate position data exists
      if (!start?.line || !start?.column || !end?.line || !end?.column) {
        return;
      }

      // format: "startLine:startCol-endLine:endCol" (1-based from unified)
      const sourcepos = `${start.line}:${start.column}-${end.line}:${end.column}`;

      node.properties = node.properties || {};
      node.properties['data-sourcepos'] = sourcepos;
    });
  };
}

// packages/extension/transpiler/mdx/transforms/collapsible.ts
// transform Collapsible/Accordion/Details components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from './types';
import {
  getStaticStringProp,
  getStaticBooleanProp,
  escapeHtml,
  createNode,
} from './utils';

// transform Collapsible/Accordion/Details component to semantic HTML
export function transformCollapsible(node: MdxJsxElement): RootContent {
  const title =
    getStaticStringProp(node, 'title') ||
    getStaticStringProp(node, 'summary') ||
    'Details';
  const defaultOpen = getStaticBooleanProp(node, 'defaultOpen') || false;

  return createNode({
    type: 'collapsible',
    hName: 'details',
    className: 'mdx-safe-collapsible',
    additionalProps: defaultOpen ? { open: true } : {},
    children: [
      createNode({
        type: 'collapsibleSummary',
        hName: 'summary',
        className: 'mdx-safe-collapsible-summary',
        children: [{ type: 'text', value: escapeHtml(title) }],
      }),
      createNode({
        type: 'collapsibleContent',
        hName: 'div',
        className: 'mdx-safe-collapsible-content',
        children: node.children,
      }),
    ],
  }) as RootContent;
}

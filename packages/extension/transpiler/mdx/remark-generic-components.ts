// packages/extension/transpiler/mdx/remark-generic-components.ts
// remark plugin to transform known generic JSX components to semantic HTML in Safe Mode

import { visit } from 'unist-util-visit';
import type { Root, Parent, RootContent } from 'mdast';

// import transforms from modular transform files
import {
  isMdxJsxElement,
  transformCallout,
  transformCollapsible,
  transformTabs,
  transformTabItem,
  transformCodeGroup,
} from './transforms';

const CALLOUT_COMPONENTS = new Set(['Callout', 'Alert', 'Admonition']);
const COLLAPSIBLE_COMPONENTS = new Set(['Collapsible', 'Accordion', 'Details']);
const TAB_COMPONENTS = new Set(['Tabs', 'TabItem', 'Tab']);

export const KNOWN_GENERIC_COMPONENTS = new Set([
  ...CALLOUT_COMPONENTS,
  ...COLLAPSIBLE_COMPONENTS,
  ...TAB_COMPONENTS,
  'CodeGroup',
]);

export interface RemarkGenericComponentsOptions {
  enabled?: boolean;
}

export default function remarkGenericComponents(
  options: RemarkGenericComponentsOptions = {}
) {
  const { enabled = true } = options;

  return (tree: Root) => {
    if (!enabled) {
      return;
    }

    visit(tree, (node, index, parent) => {
      if (index === undefined || !parent) {
        return;
      }
      if (!isMdxJsxElement(node)) {
        return;
      }

      const name = node.name;
      if (!name) {
        return;
      }

      let transformed: RootContent | null = null;

      if (CALLOUT_COMPONENTS.has(name)) {
        transformed = transformCallout(node);
      } else if (COLLAPSIBLE_COMPONENTS.has(name)) {
        transformed = transformCollapsible(node);
      } else if (name === 'Tabs') {
        transformed = transformTabs(node);
      } else if (name === 'TabItem' || name === 'Tab') {
        transformed = transformTabItem(node);
      } else if (name === 'CodeGroup') {
        transformed = transformCodeGroup(node);
      }

      if (transformed) {
        (parent as Parent).children[index] = transformed;
      }
    });
  };
}

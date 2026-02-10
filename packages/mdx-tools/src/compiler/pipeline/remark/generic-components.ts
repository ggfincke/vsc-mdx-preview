// packages/extension/compiler/shared/remark/generic-components.ts
// remark plugin to transform known generic JSX components to semantic HTML in Safe Mode

import { visit } from 'unist-util-visit';
import type { Root, Parent, RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';

// import transforms from modular transform files
import {
  isMdxJsxElement,
  transformCallout,
  transformCollapsible,
  transformTabs,
  transformTabItem,
  transformCodeGroup,
} from '../transforms';

import {
  getGenericComponentAliases,
  getGenericComponentSet,
} from '../../internal/components';

const CALLOUT_COMPONENTS = new Set([
  'Callout',
  ...getGenericComponentAliases('Callout'),
]);
const COLLAPSIBLE_COMPONENTS = new Set([
  'Collapsible',
  ...getGenericComponentAliases('Collapsible'),
]);

// export the full set of known generic components
export const KNOWN_GENERIC_COMPONENTS = getGenericComponentSet();

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

      const mdxNode: MdxJsxElement = node;
      const name = mdxNode.name;
      if (!name) {
        return;
      }

      let transformed: RootContent | null = null;

      if (CALLOUT_COMPONENTS.has(name)) {
        transformed = transformCallout(mdxNode);
      } else if (COLLAPSIBLE_COMPONENTS.has(name)) {
        transformed = transformCollapsible(mdxNode);
      } else if (name === 'Tabs') {
        transformed = transformTabs(mdxNode);
      } else if (name === 'TabItem' || name === 'Tab') {
        transformed = transformTabItem(mdxNode);
      } else if (name === 'CodeGroup') {
        transformed = transformCodeGroup(mdxNode);
      }

      if (transformed) {
        (parent as Parent).children[index] = transformed;
      }
    });
  };
}

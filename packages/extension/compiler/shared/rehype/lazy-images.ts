// packages/extension/compiler/shared/rehype/lazy-images.ts
// rehype plugin to add loading="lazy" attribute to all images for native lazy loading

import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

// add lazy loading to images
export default function rehypeLazyImages() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') {
        // add loading="lazy" if not already set
        if (!node.properties) {
          node.properties = {};
        }
        if (!node.properties.loading) {
          node.properties.loading = 'lazy';
        }
      }
    });
  };
}

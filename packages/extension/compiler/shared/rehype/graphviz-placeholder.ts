// packages/extension/compiler/shared/rehype/graphviz-placeholder.ts
// convert Graphviz code blocks to placeholders for client-side rendering

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';

// collect raw code text from code node children
function getCodeText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === 'text') {
        return (child as Text).value;
      }
      return '';
    })
    .join('');
}

// detect Graphviz language class & return canonical language id
function getGraphvizLanguage(
  classNames: Array<string | number>
): string | null {
  if (classNames.some((c) => String(c) === 'language-dot')) {
    return 'dot';
  }
  if (classNames.some((c) => String(c) === 'language-graphviz')) {
    return 'graphviz';
  }
  return null;
}

// rehype plugin to transform Graphviz code blocks into placeholder divs
export default function rehypeGraphvizPlaceholder() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre') {
        return;
      }

      const codeChild = node.children[0];
      if (
        !codeChild ||
        codeChild.type !== 'element' ||
        codeChild.tagName !== 'code'
      ) {
        return;
      }

      const className = codeChild.properties?.className;
      const classNames = Array.isArray(className)
        ? className
        : typeof className === 'string'
          ? [className]
          : [];

      const language = getGraphvizLanguage(classNames);
      if (!language) {
        return;
      }

      const code = getCodeText(codeChild);
      if (!code.trim()) {
        return;
      }

      const diagramId = `graphviz-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const placeholder: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['graphviz-container'],
          'data-graphviz-code': code,
          'data-graphviz-id': diagramId,
          'data-graphviz-language': language,
        },
        children: [],
      };

      if (parent && typeof index === 'number') {
        (parent as Element).children[index] = placeholder;
      }
    });
  };
}

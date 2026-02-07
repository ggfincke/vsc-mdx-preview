// packages/extension/compiler/shared/rehype/plantuml-placeholder.ts
// convert PlantUML code blocks to placeholders for client-side rendering

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

// rehype plugin to transform PlantUML code blocks into placeholder divs
export default function rehypePlantUmlPlaceholder() {
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

      if (!classNames.some((c) => String(c) === 'language-plantuml')) {
        return;
      }

      const code = getCodeText(codeChild);
      if (!code.trim()) {
        return;
      }

      const diagramId = `plantuml-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const placeholder: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['plantuml-container'],
          'data-plantuml-code': code,
          'data-plantuml-id': diagramId,
        },
        children: [],
      };

      if (parent && typeof index === 'number') {
        (parent as Element).children[index] = placeholder;
      }
    });
  };
}

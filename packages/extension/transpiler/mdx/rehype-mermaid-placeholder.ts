// packages/extension/transpiler/mdx/rehype-mermaid-placeholder.ts
// * convert mermaid code blocks to placeholders for client-side rendering

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';

// * rehype plugin that transforms mermaid code blocks into placeholder divs
// the webview renders these client-side using mermaid.js
export default function rehypeMermaidPlaceholder() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      // find <pre><code class="language-mermaid">...</code></pre>
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

      // check for language-mermaid class
      const className = codeChild.properties?.className;
      const classNames = Array.isArray(className)
        ? className
        : typeof className === 'string'
          ? [className]
          : [];

      if (!classNames.some((c) => String(c) === 'language-mermaid')) {
        return;
      }

      // extract code content from text node
      const textNode = codeChild.children[0] as Text | undefined;
      const code = textNode?.type === 'text' ? textNode.value : '';

      if (!code.trim()) {
        return;
      }

      // generate unique ID for this diagram
      const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // replace pre/code w/ placeholder div
      // uses data-mermaid-chart to store the diagram code
      const placeholder: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid-container'],
          'data-mermaid-chart': code,
          'data-mermaid-id': diagramId,
        },
        children: [],
      };

      // replace the pre element w/ placeholder
      if (parent && typeof index === 'number') {
        (parent as Element).children[index] = placeholder;
      }
    });
  };
}

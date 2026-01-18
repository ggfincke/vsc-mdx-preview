// packages/webview-app/src/components/shims/base/extractTextContent.ts
// Shared utility for extracting plain text from React children

import { ReactNode, isValidElement } from 'react';

/**
 * Extracts plain text content from React children.
 * Recursively traverses React element trees to build a string.
 *
 * Used by:
 * - Docusaurus CodeBlock (for copy-to-clipboard)
 * - Starlight FileTree (for parsing file/folder names)
 *
 * @param node - React children to extract text from
 * @returns Plain text content as a string
 *
 * @example
 * ```tsx
 * // String child
 * extractTextContent('hello') // 'hello'
 *
 * // Nested elements
 * extractTextContent(<div><span>hello</span> world</div>) // 'hello world'
 *
 * // Array of children
 * extractTextContent(['a', 'b', 'c']) // 'abc'
 * ```
 */
export function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }
  if (isValidElement(node)) {
    return extractTextContent(node.props.children);
  }
  return '';
}

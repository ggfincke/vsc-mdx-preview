// packages/webview-app/src/components/shims/base/extractTextContent.ts
// shared utility for extracting plain text from React children

import { ReactNode, isValidElement } from 'react';

// extracts plain text content from React children
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

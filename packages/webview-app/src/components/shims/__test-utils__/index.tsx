// Shared test utilities for framework shim component tests

import { vi } from 'vitest';
import React from 'react';

// Mocks the clipboard API for testing copy functionality
// @returns Object w/ writeText mock & cleanup function
export function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  return {
    writeText,
    cleanup: () => vi.unstubAllGlobals(),
  };
}

// Helper to create FileTree markup from a simple array notation
// Each string represents a file/directory:
// - "filename.ext" - a file
// - "dirname/" - a directory (no children)
// - Indentation w/ spaces indicates nesting level
// - "..." - placeholder
// - "**bold**" - highlighted entry
// - "name # comment" - entry w/ comment
export function createFileTreeMarkup(
  items: string[]
): React.ReactElement {
  interface TreeNode {
    name: string;
    isDir: boolean;
    isBold: boolean;
    comment?: string;
    children: TreeNode[];
  }

  const root: TreeNode[] = [];
  const stack: { indent: number; children: TreeNode[] }[] = [
    { indent: -1, children: root },
  ];

  for (const item of items) {
    const trimmed = item.trimStart();
    const indent = item.length - trimmed.length;

    // Pop stack until we find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    // Parse the item
    let name = trimmed;
    let comment: string | undefined;
    let isBold = false;

    // Check for comment
    const commentMatch = name.match(/^(.+?)\s+#\s*(.+)$/);
    if (commentMatch) {
      name = commentMatch[1];
      comment = commentMatch[2];
    }

    // Check for bold
    if (name.startsWith('**') && name.endsWith('**')) {
      isBold = true;
      name = name.slice(2, -2);
    }

    const isDir = name.endsWith('/');
    const cleanName = isDir ? name.slice(0, -1) : name;

    const node: TreeNode = {
      name: cleanName,
      isDir,
      isBold,
      comment,
      children: [],
    };

    stack[stack.length - 1].children.push(node);

    if (isDir) {
      stack.push({ indent, children: node.children });
    }
  }

  // Convert to React elements
  function renderNode(node: TreeNode): React.ReactElement {
    const nameContent = node.isBold ? <strong>{node.name}</strong> : node.name;
    const displayName = node.isDir ? `${node.name}/` : node.name;
    const displayContent = node.isBold ? (
      <strong>{displayName}</strong>
    ) : (
      displayName
    );

    if (node.children.length > 0) {
      return (
        <li key={node.name}>
          {displayContent}
          {node.comment && ` ${node.comment}`}
          <ul>{node.children.map(renderNode)}</ul>
        </li>
      );
    }

    return (
      <li key={node.name}>
        {displayContent}
        {node.comment && ` ${node.comment}`}
      </li>
    );
  }

  return <ul>{root.map(renderNode)}</ul>;
}

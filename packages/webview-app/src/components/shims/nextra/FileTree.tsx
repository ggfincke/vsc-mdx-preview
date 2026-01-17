// packages/webview-app/src/components/shims/nextra/FileTree.tsx
// Nextra FileTree component shim for MDX Preview
// Re-exports Starlight's FileTree with Nextra-specific styling wrapper

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react';
import { FileTree as StarlightFileTree } from '../starlight/FileTree';

// FileTree props (compatible with Nextra)
export interface FileTreeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// FileTree component - wraps Starlight's implementation with Nextra styling
export function FileTree({
  children,
  className,
  ...props
}: FileTreeProps): ReactElement {
  const classes = ['mdx-preview-nextra-file-tree', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      <StarlightFileTree>{children}</StarlightFileTree>
    </div>
  );
}

export default FileTree;

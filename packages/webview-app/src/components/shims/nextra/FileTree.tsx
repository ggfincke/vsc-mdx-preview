// packages/webview-app/src/components/shims/nextra/FileTree.tsx
// Nextra FileTree component shim for MDX Preview

import { FileTree as StarlightFileTree } from '../starlight/FileTree';
import { createNextraWrapper, type NextraWrapperProps } from './createNextraWrapper';

// FileTree props (compatible w/ Nextra)
export type FileTreeProps = NextraWrapperProps;

// FileTree component - wraps Starlight's implementation w/ Nextra styling
export const FileTree = createNextraWrapper({
  StarlightComponent: StarlightFileTree,
  wrapperClassName: 'mdx-preview-nextra-file-tree',
  displayName: 'NextraFileTree',
});

export default FileTree;

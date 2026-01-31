// packages/webview-app/src/components/shims/docusaurus/CodeBlock.tsx
// Docusaurus CodeBlock component shim for MDX Preview
// provides preview-compatible version of @theme/CodeBlock

import { createCodeBlock } from '../base/BaseCodeBlock';

// code block component using shared factory
export const CodeBlock = createCodeBlock({
  classPrefix: 'docusaurus-codeblock',
  codeAsString: false,
  supportsFrames: false,
  showLangBadgeWithTitle: true,
});

// re-export props type for consumers
export type { BaseCodeBlockProps as CodeBlockProps } from '../base/BaseCodeBlock';

// default export for compatibility
export default CodeBlock;

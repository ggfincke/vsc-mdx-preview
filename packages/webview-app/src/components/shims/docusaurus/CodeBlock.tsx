// packages/webview-app/src/components/shims/docusaurus/CodeBlock.tsx
// Docusaurus CodeBlock component shim for MDX Preview
// provides preview-compatible version of @theme/CodeBlock

import React, { ReactNode, ReactElement } from 'react';
import { extractTextContent } from '../base/extractTextContent';
import { CopyButton } from '../base/CopyButton';

// CodeBlock props (compatible w/ Docusaurus)
export interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  metastring?: string;
  className?: string;
}

// code block component
export function CodeBlock({
  children,
  language,
  title,
  showLineNumbers,
  className,
}: CodeBlockProps): ReactElement {
  // extract code text for copy functionality
  const codeText = extractTextContent(children).trim();

  // determine language class
  const langClass = language ? `language-${language}` : '';
  const combinedClassName = [langClass, className].filter(Boolean).join(' ');

  return (
    <div className="docusaurus-codeblock">
      {/* Title bar */}
      {title && (
        <div className="codeblock-title">
          <span className="codeblock-title-text">{title}</span>
        </div>
      )}

      {/* Code container */}
      <div className="codeblock-container">
        {/* Copy button */}
        <CopyButton
          text={codeText}
          className="codeblock-copy-button"
          copiedClassName="copied"
        />

        {/* Language badge */}
        {language && <span className="codeblock-language">{language}</span>}

        {/* Code block */}
        <pre
          className={combinedClassName}
          data-show-line-numbers={showLineNumbers}
        >
          <code className={combinedClassName}>{children}</code>
        </pre>
      </div>
    </div>
  );
}

// default export for compatibility
export default CodeBlock;

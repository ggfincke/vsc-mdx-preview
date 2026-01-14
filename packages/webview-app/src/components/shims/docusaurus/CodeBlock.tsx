// packages/webview-app/src/components/shims/docusaurus/CodeBlock.tsx
// Docusaurus CodeBlock component shim for MDX Preview
// provides preview-compatible version of @theme/CodeBlock

import React, { ReactNode, ReactElement, useState, useCallback } from 'react';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../../constants';

// CodeBlock props (compatible w/ Docusaurus)
export interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  metastring?: string;
  className?: string;
}

// extract text content from children
function extractTextContent(children: ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }
  if (React.isValidElement(children)) {
    return extractTextContent(children.props.children);
  }
  return '';
}

// code block component
export function CodeBlock({
  children,
  language,
  title,
  showLineNumbers,
  className,
}: CodeBlockProps): ReactElement {
  const [copied, setCopied] = useState(false);

  // extract code text for copy functionality
  const codeText = extractTextContent(children).trim();

  // handle copy button click
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), CODE_COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [codeText]);

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
        <button
          className={`codeblock-copy-button${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>

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

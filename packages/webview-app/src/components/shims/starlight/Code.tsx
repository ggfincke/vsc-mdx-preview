// packages/webview-app/src/components/shims/starlight/Code.tsx
// Starlight Code component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Code

import React, { ReactElement } from 'react';
import { CopyButton } from '../base/CopyButton';

// Code props (compatible w/ Starlight/Expressive Code)
export interface CodeProps {
  // Required: plaintext code content
  code: string;
  // Language for syntax highlighting
  lang?: string;
  // File tab or terminal title
  title?: string;
  // Optional metadata string
  meta?: string;
  // Lines or phrases to highlight (not implemented in shim)
  mark?: (number | string)[];
  // Frame type: code, terminal, none, or auto (detects from lang)
  frame?: 'code' | 'terminal' | 'none' | 'auto';
  // Locale for the code block (not used in shim)
  locale?: string;
}

// languages that should use terminal frame by default
const TERMINAL_LANGUAGES = new Set([
  'bash',
  'sh',
  'zsh',
  'shell',
  'console',
  'powershell',
  'ps1',
  'cmd',
  'batch',
]);

// code component
export function Code({
  code,
  lang,
  title,
  meta,
  frame = 'auto',
}: CodeProps): ReactElement {
  // Determine effective frame type
  const effectiveFrame =
    frame === 'auto'
      ? lang && TERMINAL_LANGUAGES.has(lang.toLowerCase())
        ? 'terminal'
        : 'code'
      : frame;

  // Build class names
  const langClass = lang ? `language-${lang}` : '';
  const frameClass =
    effectiveFrame !== 'none' ? `mdx-preview-starlight-code-${effectiveFrame}` : '';

  return (
    <div className={`mdx-preview-starlight-code ${frameClass}`.trim()}>
      {/* Title bar (only shown if title is provided) */}
      {title && (
        <div className="mdx-preview-starlight-code-header">
          {effectiveFrame === 'terminal' && (
            <span className="terminal-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </span>
          )}
          <span className="mdx-preview-starlight-code-title">{title}</span>
        </div>
      )}

      {/* Code container */}
      <div className="mdx-preview-starlight-code-container">
        {/* Copy button */}
        <CopyButton
          text={code}
          className="mdx-preview-starlight-code-copy"
          copiedClassName="copied"
        />

        {/* Language badge (code frame only, no title bar) */}
        {lang && effectiveFrame === 'code' && !title && (
          <span className="mdx-preview-starlight-code-lang">{lang}</span>
        )}

        {/* Code block */}
        <pre className={langClass}>
          <code className={langClass}>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default Code;

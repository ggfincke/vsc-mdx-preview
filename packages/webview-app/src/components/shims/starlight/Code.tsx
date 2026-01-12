// packages/webview-app/src/components/shims/starlight/Code.tsx
// Starlight Code component shim for MDX Preview
// provides preview-compatible version of @astrojs/starlight/components Code

import React, { ReactElement, useState, useCallback } from 'react';

// Code props (compatible with Starlight/Expressive Code)
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

// SVG icons
const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

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
  const [copied, setCopied] = useState(false);

  // Handle copy button click
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

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
    effectiveFrame !== 'none' ? `starlight-code-${effectiveFrame}` : '';

  return (
    <div className={`starlight-code ${frameClass}`.trim()}>
      {/* Title bar (only shown if title is provided) */}
      {title && (
        <div className="starlight-code-header">
          {effectiveFrame === 'terminal' && (
            <span className="terminal-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </span>
          )}
          <span className="starlight-code-title">{title}</span>
        </div>
      )}

      {/* Code container */}
      <div className="starlight-code-container">
        {/* Copy button */}
        <button
          className={`starlight-code-copy${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: copied ? CHECK_ICON : COPY_ICON,
            }}
          />
        </button>

        {/* Language badge (code frame only, no title bar) */}
        {lang && effectiveFrame === 'code' && !title && (
          <span className="starlight-code-lang">{lang}</span>
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

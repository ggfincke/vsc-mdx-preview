// packages/webview-app/src/components/shims/base/BaseCodeBlock.tsx
// factory for creating code block components (Docusaurus, Starlight, etc.)

import React, { type ReactNode, type ReactElement } from 'react';
import { extractTextContent } from './extractTextContent';
import { CopyButton } from './CopyButton';

// frame types for code blocks
type FrameType = 'code' | 'terminal' | 'none' | 'auto';

// configuration for the code block factory
interface CodeBlockConfig {
  // CSS class prefix for all elements
  classPrefix: string;
  // when true, accepts `code` string prop; when false, extracts from children
  codeAsString?: boolean;
  // enable frame type support (terminal/code/none)
  supportsFrames?: boolean;
  // languages that auto-detect as terminal
  terminalLanguages?: Set<string>;
  // show language badge when title bar is present (default: false for Starlight, true for Docusaurus)
  showLangBadgeWithTitle?: boolean;
}

// props for the generated code block component
interface BaseCodeBlockProps {
  // code as string (when codeAsString is true)
  code?: string;
  // children to extract code from (when codeAsString is false)
  children?: ReactNode;
  // language for syntax highlighting
  language?: string;
  // alternative language prop name
  lang?: string;
  // title bar text
  title?: string;
  // frame type (only when supportsFrames is true)
  frame?: FrameType;
  // additional class name
  className?: string;
  // show line numbers
  showLineNumbers?: boolean;
  // metadata string (unused, for compatibility)
  metastring?: string;
  meta?: string;
}

// export props type for consumers
export type { BaseCodeBlockProps };

// create a code block component with the given configuration
export function createCodeBlock(config: CodeBlockConfig): React.FC<BaseCodeBlockProps> {
  const {
    classPrefix,
    codeAsString = false,
    supportsFrames = false,
    terminalLanguages,
    showLangBadgeWithTitle = false,
  } = config;

  return function CodeBlock({
    code,
    children,
    language,
    lang,
    title,
    frame = 'auto',
    className,
    showLineNumbers,
  }: BaseCodeBlockProps): ReactElement {
    // resolve language (supports both `language` and `lang` props)
    const effectiveLanguage = language ?? lang;

    // extract code text: from `code` prop if codeAsString, otherwise from children
    const codeText = codeAsString
      ? (code ?? '')
      : extractTextContent(children).trim();

    // determine effective frame type
    let effectiveFrame: 'code' | 'terminal' | 'none' = 'code';
    if (supportsFrames) {
      if (frame === 'auto') {
        effectiveFrame =
          effectiveLanguage && terminalLanguages?.has(effectiveLanguage.toLowerCase())
            ? 'terminal'
            : 'code';
      } else {
        effectiveFrame = frame;
      }
    }

    // build class names
    const langClass = effectiveLanguage ? `language-${effectiveLanguage}` : '';
    const combinedPreClass = [langClass, className].filter(Boolean).join(' ');
    const frameClass =
      supportsFrames && effectiveFrame !== 'none' ? `${classPrefix}-${effectiveFrame}` : '';
    const wrapperClass = [classPrefix, frameClass].filter(Boolean).join(' ');

    // determine if language badge should be shown
    const showLanguageBadge = effectiveLanguage && (
      showLangBadgeWithTitle ||
      (!supportsFrames) ||
      (effectiveFrame === 'code' && !title)
    );

    return (
      <div className={wrapperClass}>
        {/* title bar */}
        {title && (
          <div className={`${classPrefix}-header`}>
            {supportsFrames && effectiveFrame === 'terminal' && (
              <span className="terminal-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </span>
            )}
            <span className={`${classPrefix}-title`}>{title}</span>
          </div>
        )}

        {/* code container */}
        <div className={`${classPrefix}-container`}>
          {/* copy button */}
          <CopyButton
            text={codeText}
            className={`${classPrefix}-copy`}
            copiedClassName="copied"
          />

          {/* language badge */}
          {showLanguageBadge && (
            <span className={`${classPrefix}-lang`}>{effectiveLanguage}</span>
          )}

          {/* code block */}
          <pre className={combinedPreClass} data-show-line-numbers={showLineNumbers}>
            <code className={combinedPreClass}>{codeAsString ? codeText : children}</code>
          </pre>
        </div>
      </div>
    );
  };
}

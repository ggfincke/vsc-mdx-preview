// packages/webview-app/src/components/UnknownComponentPlaceholder/UnknownComponentPlaceholder.tsx
// fallback component for unknown/missing JSX components in Trusted Mode

import type { ReactNode } from 'react';
import './styles.css';

export interface UnknownComponentPlaceholderProps {
  // original component name that was not found
  name: string;
  // children passed to the original component
  children?: ReactNode;
  // additional message or hint
  hint?: string;
}

// placeholder for unknown components in Trusted Mode
// shows component name w/ optional children in a styled box
export function UnknownComponentPlaceholder({
  name,
  children,
  hint,
}: UnknownComponentPlaceholderProps): JSX.Element {
  const hasChildren = children !== undefined && children !== null;
  const defaultHint = 'Unknown component';

  return (
    <div
      className={`mdx-preview-unknown-component ${hasChildren ? '' : 'mdx-preview-unknown-component-empty'}`}
    >
      <div className="mdx-preview-unknown-component-header">
        <span className="mdx-preview-unknown-icon" aria-hidden="true">
          <WarningIcon />
        </span>
        <code>&lt;{name}&gt;</code>
        <span className="mdx-preview-unknown-hint">({hint || defaultHint})</span>
      </div>
      {hasChildren && (
        <div className="mdx-preview-unknown-component-content">{children}</div>
      )}
    </div>
  );
}

// warning icon SVG
function WarningIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.56 1.43a.5.5 0 0 1 .88 0l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.57l6.5-12zM8 5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3A.5.5 0 0 0 8 5zm0 7a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"
      />
    </svg>
  );
}

export default UnknownComponentPlaceholder;

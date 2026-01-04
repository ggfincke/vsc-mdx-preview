// packages/webview-app/src/components/FrontmatterDisplay/FrontmatterDisplay.tsx
// * collapsible frontmatter display component (collapsed by default)

import type { Frontmatter } from '../../types';
import './FrontmatterDisplay.css';

interface Props {
  frontmatter: Frontmatter;
}

// format a frontmatter value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

// check if value need code formatting (object/array)
function needsCodeFormatting(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// * render frontmatter as collapsible details element
export function FrontmatterDisplay({ frontmatter }: Props) {
  const entries = Object.entries(frontmatter);

  // don't render if no frontmatter
  if (entries.length === 0) {
    return null;
  }

  return (
    <details className="frontmatter-display">
      <summary className="frontmatter-summary">
        <span className="frontmatter-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="currentColor"
          >
            <path d="M0 1.75A.75.75 0 0 1 .75 1h14.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 1.75ZM0 8a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8Zm.75 5.5a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H.75Z" />
          </svg>
        </span>
        <span>Frontmatter</span>
        <span className="frontmatter-count">{entries.length}</span>
      </summary>
      <dl className="frontmatter-list">
        {entries.map(([key, value]) => (
          <div key={key} className="frontmatter-item">
            <dt className="frontmatter-key">{key}</dt>
            <dd className="frontmatter-value">
              {needsCodeFormatting(value) ? (
                <pre className="frontmatter-code">{formatValue(value)}</pre>
              ) : (
                formatValue(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export default FrontmatterDisplay;

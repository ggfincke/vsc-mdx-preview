// packages/webview-client/src/features/preview/shared/ui/FrontmatterPanel/FrontmatterPanel.tsx
// collapsible fixed sidebar panel displaying parsed frontmatter key-value pairs

import { memo, useState, useCallback } from 'react';
import { useFrontmatter } from '../../../../../app/state/FrontmatterContext';
import './FrontmatterPanel.css';

// resolve JS value type label for badge display
function getTypeLabel(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function shouldRenderBlockValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 4 || value.some((item) => typeof item === 'object');
  }

  return typeof value === 'object';
}

function formatInlineValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const inlineValues = value.map((item) => {
      if (typeof item === 'string') {
        return `"${item}"`;
      }
      return String(item);
    });
    return `[${inlineValues.join(', ')}]`;
  }

  if (typeof value === 'object') {
    return '{...}';
  }

  if (typeof value === 'string') {
    return value.length === 0 ? '""' : value;
  }

  return String(value);
}

function formatBlockValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

// render a single frontmatter key-value row
function FrontmatterRow({ name, value }: { name: string; value: unknown }) {
  const typeLabel = getTypeLabel(value);
  const isBlockValue = shouldRenderBlockValue(value);
  const displayValue = isBlockValue
    ? formatBlockValue(value)
    : formatInlineValue(value);

  return (
    <tr className="mdx-fm-row">
      <td className="mdx-fm-key">{name}</td>
      <td className="mdx-fm-type">
        <span className={`mdx-fm-badge mdx-fm-badge--${typeLabel}`}>
          {typeLabel}
        </span>
      </td>
      <td className="mdx-fm-value">
        {isBlockValue ? (
          <pre className="mdx-fm-pre">{displayValue}</pre>
        ) : (
          <span className="mdx-fm-inline">{displayValue}</span>
        )}
      </td>
    </tr>
  );
}

// collapsible frontmatter panel - renders only when frontmatter has entries
export const FrontmatterPanel = memo(function FrontmatterPanel() {
  const { frontmatter } = useFrontmatter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // gate render on non-empty frontmatter
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return null;
  }

  const entries = Object.entries(frontmatter).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <aside
      className={`mdx-fm-panel${isCollapsed ? ' mdx-fm-panel--collapsed' : ''}`}
      aria-label="Frontmatter"
    >
      <button
        className="mdx-fm-toggle"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Expand frontmatter' : 'Collapse frontmatter'}
        title={isCollapsed ? 'Expand frontmatter' : 'Collapse frontmatter'}
      >
        <span className="mdx-fm-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
        {!isCollapsed && (
          <span className="mdx-fm-toggle-label">Frontmatter</span>
        )}
      </button>
      {!isCollapsed && (
        <div className="mdx-fm-content">
          <table className="mdx-fm-table">
            <thead>
              <tr>
                <th className="mdx-fm-header">Key</th>
                <th className="mdx-fm-header">Type</th>
                <th className="mdx-fm-header">Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <FrontmatterRow key={key} name={key} value={value} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
});

export default FrontmatterPanel;

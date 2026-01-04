// packages/webview-app/src/components/MermaidRenderer/MermaidRenderer.tsx
// * lazy-loaded mermaid diagram renderer w/ error handling & source toggle

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import './MermaidRenderer.css';

// gated debug logging (enable via localStorage.setItem('mdxPreviewDebug', '1'))
const DEBUG =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('mdxPreviewDebug') === '1';

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.debug('[MermaidRenderer]', ...args);
  }
}

interface Props {
  code: string;
  id: string;
}

// lazy-load mermaid (heavy ~2MB, only load when needed)
let mermaidPromise: Promise<typeof import('mermaid')> | null = null;
let mermaidInitialized = false;

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid');
  }
  return mermaidPromise;
}

// * render a single mermaid diagram w/ error handling
export function MermaidRenderer({ code, id }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const toggleSource = useCallback(() => {
    setShowSource((prev) => !prev);
  }, []);

  useEffect(() => {
    let cancelled = false;
    debugLog('render effect triggered', { id, codePreview: code.slice(0, 50) });

    async function render() {
      try {
        setIsLoading(true);
        const mermaid = await getMermaid();
        debugLog('mermaid library loaded');

        // initialize mermaid w/ strict config (no foreignObject)
        if (!mermaidInitialized) {
          mermaid.default.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'strict',
            // * disable HTML labels to produce pure SVG (no foreignObject)
            // this keeps DOMPurify allowlist tighter
            flowchart: { htmlLabels: false },
            sequence: { useMaxWidth: true },
          });
          mermaidInitialized = true;
        } else {
          // update theme if already initialized
          mermaid.default.initialize({
            theme: isDark ? 'dark' : 'default',
          });
        }

        if (cancelled || !containerRef.current) {
          return;
        }

        // render diagram to SVG
        const { svg } = await mermaid.default.render(`mermaid-svg-${id}`, code);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
          setIsLoading(false);
          debugLog('render complete', { id });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to render diagram';
          debugLog('render error', { id, error: message });
          setError(message);
          setIsLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, id, isDark]);

  // error state w/ show source toggle
  if (error) {
    return (
      <div className="mermaid-error">
        <div className="mermaid-error-header">
          <span className="mermaid-error-icon">!</span>
          <span className="mermaid-error-message">
            Mermaid parse error: {error}
          </span>
        </div>
        <button
          onClick={toggleSource}
          className="mermaid-toggle-source"
          type="button"
        >
          {showSource ? 'Hide source' : 'Show source'}
        </button>
        {showSource && (
          <pre className="mermaid-source">
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  }

  // * always render container so ref is available for mermaid.render()
  // show loading overlay on top while loading, hide diagram until ready
  return (
    <div className="mermaid-container">
      {isLoading && (
        <div className="mermaid-loading-overlay">
          <div className="mermaid-loading-spinner" />
          <span>Loading diagram...</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-diagram"
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      />
    </div>
  );
}

export default MermaidRenderer;

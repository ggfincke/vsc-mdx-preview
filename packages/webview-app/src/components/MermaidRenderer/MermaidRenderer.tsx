// packages/webview-app/src/components/MermaidRenderer/MermaidRenderer.tsx
// lazy-loaded mermaid diagram renderer w/ error handling & source toggle

import { useRef, useState, useCallback } from 'react';
import { extractErrorMessage, LogTags } from '@mdx-preview/shared';
import { createTaggedLogger } from '../../utils/createTaggedLogger';
import { useAsyncEffect } from '../../hooks';
import { useTheme } from '../../theme';
import './MermaidRenderer.css';

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.MERMAID_RENDERER);

interface Props {
  code: string;
  id: string;
}

// lazy-load mermaid (heavy ~2MB, only load when needed)
let mermaidPromise: Promise<typeof import('mermaid')> | null = null;

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid');
  }
  return mermaidPromise;
}

// check if mermaid theme is dark (needs dark background)
function isDarkMermaidTheme(theme: string): boolean {
  return theme === 'dark';
}

// cache for mermaid initialization - avoid re-initializing w/ same config
let lastInitializedTheme: string | null = null;
let lastInitializedDark: boolean | null = null;

// render a single mermaid diagram w/ error handling
export function MermaidRenderer({ code, id }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mermaidTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isDark = isDarkMermaidTheme(mermaidTheme);

  const toggleSource = useCallback(() => {
    setShowSource((prev) => !prev);
  }, []);

  useAsyncEffect(
    async (signal) => {
      log.debug('render effect triggered', { id, codePreview: code.slice(0, 50) });

      const mermaid = await getMermaid();
      log.debug('mermaid library loaded');

      // Only re-initialize if theme or dark state changed (perf optimization)
      const needsReinit =
        lastInitializedTheme !== mermaidTheme || lastInitializedDark !== isDark;

      if (needsReinit) {
        log.debug('initializing mermaid with theme', { mermaidTheme, isDark });
        // initialize mermaid w/ strict config (no foreignObject)
        // theme is controlled by user setting (mdx-preview.preview.mermaidTheme)
        mermaid.default.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          securityLevel: 'strict',
          // disable HTML labels to produce pure SVG (no foreignObject)
          // this keeps DOMPurify allowlist tighter
          flowchart: { htmlLabels: false },
          sequence: { useMaxWidth: true },
          // fix ER diagram relationship label contrast
          themeCSS: `
            .edgeLabel text,
            .edgeLabel tspan,
            .edgeLabel span,
            .edgeLabel .label text,
            .edgeLabel .label tspan,
            .edgeLabel .label span,
            .edgeLabel foreignObject div {
              fill: ${isDark ? '#fff' : '#000'} !important;
              color: ${isDark ? '#fff' : '#000'} !important;
            }
            .relationshipLabelBox,
            .relationshipLabelBox rect,
            .edgeLabel .label rect.background {
              fill: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
              stroke: ${isDark ? '#555' : '#ccc'} !important;
              stroke-width: 1px !important;
              opacity: 1 !important;
            }
          `,
        });
        lastInitializedTheme = mermaidTheme;
        lastInitializedDark = isDark;
      }

      if (signal.isCancelled() || !containerRef.current) {
        return;
      }

      // render diagram to SVG
      const { svg } = await mermaid.default.render(`mermaid-svg-${id}`, code);

      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        setError(null);
        log.debug('render complete', { id });
      }
    },
    [code, id, mermaidTheme],
    {
      onError: (err) => {
        const message = extractErrorMessage(err) || 'Failed to render diagram';
        log.debug('render error', { id, error: message });
        setError(message);
      },
      onLoadingChange: setIsLoading,
    }
  );

  // error state w/ show source toggle
  if (error) {
    return (
      <div className="mdx-preview-mermaid-error">
        <div className="mdx-preview-mermaid-error-header">
          <span className="mdx-preview-mermaid-error-icon">!</span>
          <span className="mdx-preview-mermaid-error-msg">
            Mermaid parse error: {error}
          </span>
        </div>
        <button
          onClick={toggleSource}
          className="mdx-preview-mermaid-toggle"
          type="button"
        >
          {showSource ? 'Hide source' : 'Show source'}
        </button>
        {showSource && (
          <pre className="mdx-preview-mermaid-source">
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  }

  // always render container so ref is available for mermaid.render()
  // show loading overlay on top while loading, hide diagram until ready
  return (
    <div className="mdx-preview-mermaid">
      {isLoading && (
        <div className="mdx-preview-mermaid-loading">
          <div className="mdx-preview-mermaid-spinner" />
          <span>Loading diagram...</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="mdx-preview-mermaid-diagram"
        data-theme={isDark ? 'dark' : 'light'}
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      />
    </div>
  );
}

export default MermaidRenderer;

// packages/webview-app/src/components/GraphvizRenderer/GraphvizRenderer.tsx
// lazy Graphviz renderer w/ client-side DOT to SVG conversion

import { useRef, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { extractErrorMessage, LogTags } from '@mdx-preview/shared';
import { createTaggedLogger } from '../../utils/createTaggedLogger';
import { useAsyncEffect } from '../../hooks';
import { useTheme } from '../../theme';
import { DOMPURIFY_CONFIG } from '../../security/allowlist';
import './GraphvizRenderer.css';

const log = createTaggedLogger(LogTags.GRAPHVIZ_RENDERER);

type VizModule = typeof import('@viz-js/viz');
type VizInstance = Awaited<ReturnType<VizModule['instance']>>;

interface Props {
  code: string;
  id: string;
  language: 'dot' | 'graphviz';
}

// lazy-load Graphviz engine (WASM) once
let vizInstancePromise: Promise<VizInstance> | null = null;

function getVizInstance(): Promise<VizInstance> {
  if (!vizInstancePromise) {
    vizInstancePromise = import('@viz-js/viz').then((mod) => mod.instance());
  }
  return vizInstancePromise;
}

// sanitize rendered SVG before inserting into DOM
function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, DOMPURIFY_CONFIG) as string;
}

// render a single Graphviz diagram w/ error handling
export function GraphvizRenderer({ code, id, language }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const toggleSource = useCallback(() => {
    setShowSource((prev) => !prev);
  }, []);

  useAsyncEffect(
    async (signal) => {
      log.debug('render effect triggered', {
        id,
        language,
        codePreview: code.slice(0, 50),
      });

      const viz = await getVizInstance();

      if (signal.isCancelled()) {
        return;
      }

      // colors set as defaults; dark mode overrides via CSS (!important)
      const svg = viz.renderString(code, {
        format: 'svg',
        engine: 'dot',
        graphAttributes: {
          bgcolor: 'transparent',
          fontname: 'sans-serif',
        },
        nodeAttributes: {
          fontname: 'sans-serif',
        },
        edgeAttributes: {
          fontname: 'sans-serif',
        },
      });

      if (signal.isCancelled() || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = sanitizeSvg(svg);
      setError(null);
      log.debug('render complete', { id });
    },
    [code, id, language],
    {
      onError: (err) => {
        const message = extractErrorMessage(err) || 'Failed to render diagram';
        log.debug('render error', { id, error: message });
        setError(message);
      },
      onLoadingChange: setIsLoading,
    }
  );

  if (error) {
    return (
      <div className="mdx-preview-graphviz-error">
        <div className="mdx-preview-graphviz-error-header">
          <span className="mdx-preview-graphviz-error-icon">!</span>
          <span className="mdx-preview-graphviz-error-msg">
            Graphviz render error: {error}
          </span>
        </div>
        <button
          onClick={toggleSource}
          className="mdx-preview-graphviz-toggle"
          type="button"
        >
          {showSource ? 'Hide source' : 'Show source'}
        </button>
        {showSource && (
          <pre className="mdx-preview-graphviz-source">
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="mdx-preview-graphviz">
      {isLoading && (
        <div className="mdx-preview-graphviz-loading">
          <div className="mdx-preview-graphviz-spinner" />
          <span>Rendering diagram...</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="mdx-preview-graphviz-diagram"
        data-theme={isDark ? 'dark' : 'light'}
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      />
    </div>
  );
}

export default GraphvizRenderer;

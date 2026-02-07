// packages/webview-app/src/components/PlantUMLRenderer/PlantUMLRenderer.tsx
// PlantUML renderer - renders via extension host proxy to avoid CORS

import { useRef, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { extractErrorMessage, LogTags } from '@mdx-preview/shared';
import { createTaggedLogger } from '../../utils/createTaggedLogger';
import { useAsyncEffect } from '../../hooks';
import { useTheme } from '../../theme';
import { ExtensionHandle } from '../../rpc-webview';
import { DOMPURIFY_CONFIG } from '../../security/allowlist';
import './PlantUMLRenderer.css';

const log = createTaggedLogger(LogTags.PLANTUML_RENDERER);

interface Props {
  code: string;
  id: string;
}

// sanitize rendered SVG before inserting into DOM
function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, DOMPURIFY_CONFIG) as string;
}

// render a single PlantUML diagram w/ error handling
export function PlantUMLRenderer({ code, id }: Props) {
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
        codePreview: code.slice(0, 50),
      });

      // render via extension host proxy (avoids CORS restrictions)
      const svg = await ExtensionHandle.renderPlantUml(code);

      if (signal.isCancelled() || !containerRef.current) {
        return;
      }

      if (!svg) {
        throw new Error('Failed to render diagram');
      }

      containerRef.current.innerHTML = sanitizeSvg(svg);
      setError(null);
      log.debug('render complete', { id });
    },
    [code, id],
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
      <div className="mdx-preview-plantuml-error">
        <div className="mdx-preview-plantuml-error-header">
          <span className="mdx-preview-plantuml-error-icon">!</span>
          <span className="mdx-preview-plantuml-error-msg">
            PlantUML render error: {error}
          </span>
        </div>
        <button
          onClick={toggleSource}
          className="mdx-preview-plantuml-toggle"
          type="button"
        >
          {showSource ? 'Hide source' : 'Show source'}
        </button>
        {showSource && (
          <pre className="mdx-preview-plantuml-source">
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="mdx-preview-plantuml">
      {isLoading && (
        <div className="mdx-preview-plantuml-loading">
          <div className="mdx-preview-plantuml-spinner" />
          <span>Rendering diagram...</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="mdx-preview-plantuml-diagram"
        data-theme={isDark ? 'dark' : 'light'}
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      />
    </div>
  );
}

export default PlantUMLRenderer;

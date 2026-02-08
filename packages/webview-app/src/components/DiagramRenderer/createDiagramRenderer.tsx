// packages/webview-app/src/components/DiagramRenderer/createDiagramRenderer.tsx
// factory for creating diagram renderer components w/ shared state & JSX

import { useRef, useState, useCallback } from 'react';
import { extractErrorMessage } from '@mdx-preview/shared';
import { createTaggedLogger } from '../../utils/createTaggedLogger';
import { useAsyncEffect, type CancellationSignal } from '../../hooks';

// base props all diagram renderers share
export interface DiagramRendererBaseProps {
  code: string;
  id: string;
}

// configuration for creating a diagram renderer component
export interface DiagramRendererConfig<P extends DiagramRendererBaseProps> {
  // CSS class prefix (e.g., 'mdx-preview-mermaid')
  classPrefix: string;
  // error message prefix (e.g., 'Mermaid parse error')
  errorLabel: string;
  // loading message text (e.g., 'Loading diagram...')
  loadingText: string;
  // log tag for tagged logger
  logTag: string;
  // render function: produce SVG string from props
  // receives themeValue from useThemeValue hook
  render: (
    props: P,
    signal: CancellationSignal,
    themeValue: string
  ) => Promise<string>;
  // optional SVG sanitization (e.g., DOMPurify)
  sanitize?: (svg: string) => string;
  // hook called inside component body to extract theme value
  useThemeValue: () => string;
  // convert theme value to data-theme attribute (default: identity)
  toDataTheme?: (themeValue: string) => string;
  // extra deps for useAsyncEffect beyond [code, id, themeValue]
  extraDeps?: (props: P) => unknown[];
}

// * factory for creating diagram renderer components
export function createDiagramRenderer<
  P extends DiagramRendererBaseProps = DiagramRendererBaseProps,
>(config: DiagramRendererConfig<P>): React.FC<P> {
  const log = createTaggedLogger(config.logTag);
  const prefix = config.classPrefix;
  const resolveDataTheme = config.toDataTheme ?? ((v: string) => v);

  function DiagramRenderer(props: P) {
    const { code, id } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const themeValue = config.useThemeValue();
    const dataTheme = resolveDataTheme(themeValue);
    const [error, setError] = useState<string | null>(null);
    const [showSource, setShowSource] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const toggleSource = useCallback(() => {
      setShowSource((prev) => !prev);
    }, []);

    const extraDeps = config.extraDeps?.(props) ?? [];

    useAsyncEffect(
      async (signal) => {
        log.debug('render effect triggered', {
          id,
          codePreview: code.slice(0, 50),
        });

        const svg = await config.render(props, signal, themeValue);

        if (signal.isCancelled() || !containerRef.current) {
          return;
        }

        const processed = config.sanitize ? config.sanitize(svg) : svg;
        containerRef.current.innerHTML = processed;
        setError(null);
        log.debug('render complete', { id });
      },
      [code, id, themeValue, ...extraDeps],
      {
        onError: (err) => {
          const message =
            extractErrorMessage(err) || 'Failed to render diagram';
          log.debug('render error', { id, error: message });
          setError(message);
        },
        onLoadingChange: setIsLoading,
      }
    );

    // error state w/ show source toggle
    if (error) {
      return (
        <div className={`${prefix}-error`}>
          <div className={`${prefix}-error-header`}>
            <span className={`${prefix}-error-icon`}>!</span>
            <span className={`${prefix}-error-msg`}>
              {config.errorLabel}: {error}
            </span>
          </div>
          <button
            onClick={toggleSource}
            className={`${prefix}-toggle`}
            type="button"
          >
            {showSource ? 'Hide source' : 'Show source'}
          </button>
          {showSource && (
            <pre className={`${prefix}-source`}>
              <code>{code}</code>
            </pre>
          )}
        </div>
      );
    }

    // diagram container w/ loading overlay
    return (
      <div className={prefix}>
        {isLoading && (
          <div className={`${prefix}-loading`}>
            <div className={`${prefix}-spinner`} />
            <span>{config.loadingText}</span>
          </div>
        )}
        <div
          ref={containerRef}
          className={`${prefix}-diagram`}
          data-theme={dataTheme}
          style={{ visibility: isLoading ? 'hidden' : 'visible' }}
        />
      </div>
    );
  }

  return DiagramRenderer;
}

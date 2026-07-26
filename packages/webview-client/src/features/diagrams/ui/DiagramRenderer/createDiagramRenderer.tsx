// packages/webview-client/src/features/diagrams/ui/DiagramRenderer/createDiagramRenderer.tsx
// factory for creating diagram renderer components w/ shared state & JSX

import { useRef, useState, useCallback } from 'react';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { createTaggedLogger } from '../../../../shared/utils/createTaggedLogger';
import { cn } from '../../../../shared/utils/cn';
import {
  useAsyncEffect,
  type CancellationSignal,
} from '../../../../shared/hooks';
import { getDiagramResult } from '../../utils/diagramResultCache';

// stable shared classes so diagram-shared.css targets one set of selectors
// instead of hard-coding every per-renderer prefix; prefix classes are kept
// alongside these for renderer-specific overrides (e.g. dark-mode SVG fills)
const SHARED = {
  root: 'mdx-preview-diagram',
  surface: 'mdx-preview-diagram-surface',
  loading: 'mdx-preview-diagram-loading',
  spinner: 'mdx-preview-diagram-spinner',
  error: 'mdx-preview-diagram-error',
  errorHeader: 'mdx-preview-diagram-error-header',
  errorIcon: 'mdx-preview-diagram-error-icon',
  errorMsg: 'mdx-preview-diagram-error-msg',
  toggle: 'mdx-preview-diagram-toggle',
  source: 'mdx-preview-diagram-source',
} as const;

// base props all diagram renderers share
export interface DiagramRendererBaseProps {
  code: string;
  id: string;
}

// configuration for creating a diagram renderer component
export interface DiagramRendererConfig<P extends DiagramRendererBaseProps> {
  // stable adapter family for cache isolation
  cacheFamily: string;
  // CSS class prefix (e.g., 'mdx-preview-mermaid')
  classPrefix: string;
  // error message prefix (e.g., 'Mermaid parse error')
  errorLabel: string;
  // loading message text (e.g., 'Loading diagram...')
  loadingText: string;
  // log tag for tagged logger
  logTag: string;
  // render function: produce SVG string from props
  // receive themeValue from useThemeValue hook
  render: (
    props: P,
    signal: CancellationSignal,
    themeValue: string
  ) => Promise<string>;
  // optional SVG sanitization (e.g., DOMPurify)
  sanitize?: (svg: string) => string;
  // hook called inside component body to extract theme value
  useThemeValue: () => string;
  // optional hook for renderer state beyond theme (e.g. icon packs or server)
  useCacheKeyValue?: () => string;
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
  const useCacheKeyValue = config.useCacheKeyValue ?? (() => '');

  function DiagramRenderer(props: P) {
    const { code, id } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const renderedResultRef = useRef<string | null>(null);
    const themeValue = config.useThemeValue();
    const cacheKeyValue = useCacheKeyValue();
    const resultCacheKey = JSON.stringify([code, themeValue, cacheKeyValue]);
    const dataTheme = resolveDataTheme(themeValue);
    const [error, setError] = useState<string | null>(null);
    const [showSource, setShowSource] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const toggleSource = useCallback(() => {
      setShowSource((prev) => !prev);
    }, []);

    const setContainerRef = useCallback((container: HTMLDivElement | null) => {
      containerRef.current = container;
      if (container && renderedResultRef.current !== null) {
        container.innerHTML = renderedResultRef.current;
      }
    }, []);

    const extraDeps = config.extraDeps?.(props) ?? [];

    useAsyncEffect(
      async (signal) => {
        log.debug('render effect triggered', {
          id,
          codePreview: code.slice(0, 50),
        });

        const processed = await getDiagramResult(
          config.cacheFamily,
          resultCacheKey,
          () =>
            config.render(
              props,
              {
                // shared work must finish when one of its consumers unmounts
                isCancelled: () => false,
              },
              themeValue
            ),
          config.sanitize
        );

        if (signal.isCancelled()) {
          return;
        }

        renderedResultRef.current = processed;
        if (containerRef.current) {
          containerRef.current.innerHTML = processed;
        }
        setError(null);
        log.debug('render complete', { id });
      },
      [id, resultCacheKey, ...extraDeps],
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
        <div className={cn(`${prefix}-error`, SHARED.error)}>
          <div className={cn(`${prefix}-error-header`, SHARED.errorHeader)}>
            <span className={cn(`${prefix}-error-icon`, SHARED.errorIcon)}>
              !
            </span>
            <span className={cn(`${prefix}-error-msg`, SHARED.errorMsg)}>
              {config.errorLabel}: {error}
            </span>
          </div>
          <button
            onClick={toggleSource}
            className={cn(`${prefix}-toggle`, SHARED.toggle)}
            type="button"
          >
            {showSource ? 'Hide source' : 'Show source'}
          </button>
          {showSource && (
            <pre className={cn(`${prefix}-source`, SHARED.source)}>
              <code>{code}</code>
            </pre>
          )}
        </div>
      );
    }

    // diagram container w/ loading overlay
    return (
      <div className={cn(prefix, SHARED.root)}>
        {isLoading && (
          <div className={cn(`${prefix}-loading`, SHARED.loading)}>
            <div className={cn(`${prefix}-spinner`, SHARED.spinner)} />
            <span>{config.loadingText}</span>
          </div>
        )}
        <div
          ref={setContainerRef}
          className={cn(`${prefix}-diagram`, SHARED.surface)}
          data-theme={dataTheme}
          style={{ visibility: isLoading ? 'hidden' : 'visible' }}
        />
      </div>
    );
  }

  return DiagramRenderer;
}

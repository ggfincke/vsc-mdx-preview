// packages/webview-app/src/App.tsx
// * MDX Preview App - single React root managing preview rendering (Safe & Trusted mode)
// * State is now managed via granular React contexts for reduced re-renders

import { useCallback, useEffect, useMemo, useState, type ComponentType, type MouseEvent } from 'react';
import LoadingBar from './components/LoadingBar/LoadingBar';
import { MDXErrorBoundary, ErrorDisplay } from './components/ErrorBoundary/ErrorBoundary';
import { TrustBanner } from './components/TrustBanner/TrustBanner';
import { StaleIndicator } from './components/StaleIndicator/StaleIndicator';
import { SafePreviewRenderer } from './SafePreview';
import { TrustedPreviewRenderer } from './TrustedPreview';
import { ExtensionHandle } from './rpc-webview';
import { debug } from './utils/debug';
import { LogTags } from '@mdx-preview/shared';
import { classifyLink } from './utils/linkHandler';
import type { TrustedPreviewContent } from './types';
import { useTheme } from './theme';
import { ZOOM_DEFAULT_PERCENT } from './constants';
import {
  useTrust,
  usePreview,
  useLoading,
  useZoom,
  useNextra,
} from './context';
import './App.css';
import './styles/admonitions.css';
// Base styles (shared via data-attribute selectors) - always needed
import './components/shims/base/styles/index.css';
// Framework-specific styles are now lazy-loaded via frameworkCssLoader.ts
// when the corresponding framework shims are loaded in preload/index.ts

debug(`[${LogTags.APP}] App.tsx module loaded`);

function App() {
  debug(`[${LogTags.APP}] App component rendering`);

  // consume state from granular contexts
  const { trustState } = useTrust();
  const { content, error, setError, clearError } = usePreview();
  const { isLoading, isStale } = useLoading();

  // evaluatedComponent kept in local state (not context) to avoid React #130 issue
  // The context's useMemo was causing the component function to become an object
  const [evaluatedComponent, setEvaluatedComponent] = useState<ComponentType | null>(null);

  // clear evaluated component when content changes (new file or file modified)
  useEffect(() => {
    setEvaluatedComponent(null);
  }, [content]);
  const { zoomLevel } = useZoom();
  const { nextraMeta } = useNextra();

  // get theme context for MPE preview themes
  const { previewTheme } = useTheme();

  debug(
    `[${LogTags.APP}] Render state: isLoading=${isLoading}, content=${content?.mode ?? 'null'}, error=${error ? 'yes' : 'no'}, isStale=${isStale}`
  );

  // intercept Ctrl/Cmd+clicks on external links & route to extension
  const handleLinkClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }

    const linkType = classifyLink(href);

    // only handle external links w/ Ctrl/Cmd+click
    if (linkType === 'external') {
      const isModifierClick = event.metaKey || event.ctrlKey;
      if (!isModifierClick) {
        return;
      }

      event.preventDefault();
      debug(`[${LogTags.APP}] Ctrl/Cmd+click external link: ${href}`);
      ExtensionHandle.openExternal(href);
    }
  }, []);

  // compute Nextra layout class from metadata (memoized to avoid string recreation)
  const nextraLayoutClass = useMemo(() => {
    if (nextraMeta?.layout === 'full') {
      return 'nextra-layout-full';
    }
    if (nextraMeta?.layout === 'raw') {
      return 'nextra-layout-raw';
    }
    return '';
  }, [nextraMeta?.layout]);

  // memoize zoom style object to avoid new object creation on every render
  const zoomStyle = useMemo(() => {
    if (zoomLevel === ZOOM_DEFAULT_PERCENT) {
      return undefined;
    }
    return {
      transform: `scale(${zoomLevel / ZOOM_DEFAULT_PERCENT})`,
      transformOrigin: 'top center',
    };
  }, [zoomLevel]);

  // render loading state during initial load
  if (isLoading && !content && !error) {
    debug(`[${LogTags.APP}] Rendering LoadingBar (initial loading)`);
    return <LoadingBar />;
  }

  // render error state w/ unified ErrorDisplay component
  if (error) {
    debug(`[${LogTags.APP}] Rendering error state`);
    // Convert PreviewError to Error for ErrorDisplay, preserving moduleError data
    const errorObj = new Error(error.message) as Error & {
      moduleError?: typeof error.moduleError;
    };
    if (error.stack) {
      errorObj.stack = error.stack;
    }
    if (error.moduleError) {
      errorObj.moduleError = error.moduleError;
    }
    return (
      <div className="mdx-preview-container">
        <ErrorDisplay
          error={errorObj}
          onReset={clearError}
          title="Preview Error"
        />
      </div>
    );
  }

  // render loading state when awaiting content
  if (!content) {
    debug(`[${LogTags.APP}] Rendering LoadingBar (no content)`);
    return <LoadingBar />;
  }

  // render preview content in Safe or Trusted Mode
  debug(`[${LogTags.APP}] Rendering content in ${content.mode} mode`);

  return (
    <div
      className={`mdx-preview-container ${nextraLayoutClass}`.trim()}
      onClick={handleLinkClick}
      data-mpe-theme-active={previewTheme !== 'none' ? 'true' : undefined}
    >
      <StaleIndicator isStale={isStale} />
      {!trustState.canExecute && <TrustBanner trustState={trustState} />}
      <MDXErrorBoundary
        onError={(err) => setError({ message: err.message, stack: err.stack })}
      >
        <div className="mdx-preview-content" style={zoomStyle}>
          {nextraMeta?.title && (
            <h1 className="nextra-page-title">{nextraMeta.title}</h1>
          )}
          {content.mode === 'safe' ? (
            <SafePreviewRenderer html={content.html} />
          ) : (
            <TrustedPreviewRenderer
              content={content as TrustedPreviewContent}
              evaluatedComponent={evaluatedComponent}
              onComponentReady={setEvaluatedComponent}
              onError={setError}
            />
          )}
        </div>
      </MDXErrorBoundary>
    </div>
  );
}

export default App;

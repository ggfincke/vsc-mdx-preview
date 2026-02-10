// packages/webview-app/src/App.tsx
// MDX Preview App - single React root managing preview rendering (Safe & Trusted mode)

import { useCallback, useEffect, useState, type ComponentType, type MouseEvent } from 'react';
import LoadingBar from '../features/preview/shared/ui/LoadingBar/LoadingBar';
import { MDXErrorBoundary, ErrorDisplay } from '../shared/ui/error-boundary/ErrorBoundary';
import { TrustBanner } from '../features/preview/shared/ui/TrustBanner/TrustBanner';
import { StaleIndicator } from '../features/preview/shared/ui/StaleIndicator/StaleIndicator';
import { SafePreviewRenderer } from '../features/preview/safe/SafePreview';
import { TrustedPreviewRenderer } from '../features/preview/trusted/TrustedPreview';
import { ExtensionHandle } from '../platform/rpc/webview-rpc-client';
import { createTaggedLogger } from '../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/shared';
import { classifyLink } from '../shared/utils/linkHandler';
import type { TrustedPreviewContent } from './types';
import { useTheme } from '../features/theme/runtime';
import {
  useTrust,
  usePreview,
  useLoading,
  useNextra,
} from './state';
import './styles/App.css';
import '../features/preview/shared/styles/admonitions.css';
// base generic shim styles from extracted doc-components library
import 'mdx-tools/components/styles/generic.css';
// framework-specific styles are lazy-loaded via frameworkCssLoader.ts

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

log.debug('App.tsx module loaded');

function App() {
  log.debug('App component rendering');

  // consume state from granular contexts
  const { trustState } = useTrust();
  const { content, error, setError, clearError } = usePreview();
  const { isLoading, isStale } = useLoading();

  // evaluatedComponent kept in local state (not context) to avoid React #130 issue
  const [evaluatedComponent, setEvaluatedComponent] = useState<ComponentType | null>(null);

  // clear evaluated component when content changes (new file or file modified)
  useEffect(() => {
    setEvaluatedComponent(null);
  }, [content]);
  const { nextraMeta } = useNextra();

  // get theme context for MPE preview themes
  const { previewTheme } = useTheme();

  log.debug(
    `Render state: isLoading=${isLoading}, content=${content?.mode ?? 'null'}, error=${error ? 'yes' : 'no'}, isStale=${isStale}`
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
      log.debug(`Ctrl/Cmd+click external link: ${href}`);
      ExtensionHandle.openExternal(href);
    }
  }, []);

  // compute Nextra layout class from metadata
  const nextraLayoutClass =
    nextraMeta?.layout === 'full'
      ? 'nextra-layout-full'
      : nextraMeta?.layout === 'raw'
        ? 'nextra-layout-raw'
        : '';

  // render loading state during initial load
  if (isLoading && !content && !error) {
    log.debug('Rendering LoadingBar (initial loading)');
    return <LoadingBar />;
  }

  // render error state w/ unified ErrorDisplay component
  if (error) {
    log.debug('Rendering error state');
    // convert PreviewError to Error for ErrorDisplay, preserving moduleError data
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
    log.debug('Rendering LoadingBar (no content)');
    return <LoadingBar />;
  }

  // render preview content in Safe or Trusted Mode
  log.debug(`Rendering content in ${content.mode} mode`);

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
        <div className="mdx-preview-content">
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

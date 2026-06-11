// packages/webview-client/src/app/App.tsx
// MDX Preview App - single React root managing preview rendering (Safe & Trusted mode)

import {
  useCallback,
  useState,
  type ComponentType,
  type MouseEvent,
} from 'react';
import LoadingBar from '../features/preview/shared/ui/LoadingBar/LoadingBar';
import {
  MDXErrorBoundary,
  ErrorDisplay,
} from '../shared/ui/error-boundary/ErrorBoundary';
import { TrustBanner } from '../features/preview/shared/ui/TrustBanner/TrustBanner';
import { StaleIndicator } from '../features/preview/shared/ui/StaleIndicator/StaleIndicator';
import { SafePreviewRenderer } from '../features/preview/safe/SafePreview';
import { TrustedPreviewRenderer } from '../features/preview/trusted/TrustedPreview';
import { ExtensionHandle } from '../platform/rpc/webview-rpc-client';
import { canRenderTrusted } from '../platform/rpc/content-mode-guard';
import { createTaggedLogger } from '../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { classifyLink } from '../shared/utils/linkHandler';
import type { TrustedPreviewContent } from './types';
import { useTheme } from '../features/theme/runtime';
import { useTrust, usePreview, useLoading, useUIFlags } from './state';
import { PREVIEW_CONTENT_CLASS, PREVIEW_ROOT_CLASS } from './constants';
import './styles/App.css';
import '../features/preview/shared/styles/admonitions.css';
// base generic shim styles from extracted doc-components library
import 'mdx-forge/components/styles/generic.css';
import '../features/shims/vscode-dark-adapter.css';
// framework-specific styles are lazy-loaded via frameworkCssLoader.ts

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

log.debug('App.tsx module loaded');

function App() {
  log.debug('App component rendering');

  // consume state from granular contexts
  const { trustState } = useTrust();
  const { content, error, setError, clearError, nextraMeta } = usePreview();
  const { isLoading, isStale } = useLoading();

  // evaluatedComponent kept in local state (not context) to avoid React #130 issue
  const [evaluatedComponent, setEvaluatedComponent] =
    useState<ComponentType | null>(null);
  const [previousContent, setPreviousContent] = useState(content);

  // clear evaluated component before painting changed content
  if (previousContent !== content) {
    setPreviousContent(content);
    setEvaluatedComponent(null);
  }
  const { shimSideRailEnabled, sourceLineHighlightColorMode, zoomLevel } =
    useUIFlags();

  // get theme context for MPE preview themes
  const { previewTheme } = useTheme();

  log.debug(
    `Render state: isLoading=${isLoading}, content=${content?.mode ?? 'null'}, error=${error ? 'yes' : 'no'}, isStale=${isStale}`
  );

  // intercept external link clicks & route to extension
  // (webview sandbox prevents direct navigation, so all external links go through openExternal)
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

    // route all external links through extension
    if (linkType === 'external') {
      event.preventDefault();
      log.debug(`Opening external link: ${href}`);
      ExtensionHandle.openExternal(href);
    }
  }, []);

  // stable boundary handler keeps ErrorBoundary's window listeners registered once
  const handleBoundaryError = useCallback(
    (err: Error) => setError({ message: err.message, stack: err.stack }),
    [setError]
  );

  // compute Nextra layout class from metadata
  const nextraLayoutClass =
    nextraMeta?.layout === 'full'
      ? 'nextra-layout-full'
      : nextraMeta?.layout === 'raw'
        ? 'nextra-layout-raw'
        : '';

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
      <div className={PREVIEW_ROOT_CLASS}>
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

  const shouldRenderTrustedContent =
    content.mode === 'trusted' && canRenderTrusted(trustState);

  return (
    <div
      className={`${PREVIEW_ROOT_CLASS} ${nextraLayoutClass}`.trim()}
      onClick={handleLinkClick}
      style={zoomLevel !== 1 ? { zoom: zoomLevel } : undefined}
      data-mpe-theme-active={previewTheme !== 'none' ? 'true' : undefined}
      data-shim-side-rail={shimSideRailEnabled ? 'on' : 'off'}
      data-source-line-highlight-color={sourceLineHighlightColorMode}
    >
      <StaleIndicator isStale={isStale} />
      {!trustState.canExecute && <TrustBanner trustState={trustState} />}
      <MDXErrorBoundary onError={handleBoundaryError}>
        <div className={PREVIEW_CONTENT_CLASS}>
          {nextraMeta?.title && (
            <h1 className="nextra-page-title">{nextraMeta.title}</h1>
          )}
          {content.mode === 'safe' ? (
            <SafePreviewRenderer html={content.html} />
          ) : shouldRenderTrustedContent ? (
            <TrustedPreviewRenderer
              content={content as TrustedPreviewContent}
              evaluatedComponent={evaluatedComponent}
              onComponentReady={setEvaluatedComponent}
              onError={setError}
            />
          ) : null}
        </div>
      </MDXErrorBoundary>
    </div>
  );
}

export default App;

// packages/webview-app/src/App.tsx
// * MDX Preview App - single React root managing preview rendering (Safe & Trusted mode via React state)

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  ComponentType,
  MouseEvent,
} from 'react';
import LoadingBar from './components/LoadingBar/LoadingBar';
import { MDXErrorBoundary, ErrorDisplay } from './components/ErrorBoundary';
import { TrustBanner } from './components/TrustBanner/TrustBanner';
import { StaleIndicator } from './components/StaleIndicator';
import { SafePreviewRenderer } from './SafePreview';
import { TrustedPreviewRenderer } from './TrustedPreview';
import { registerWebviewHandlers, ExtensionHandle } from './rpc-webview';
import { debug } from './utils/debug';
import { classifyLink } from './utils/linkHandler';
import type {
  TrustState,
  PreviewContent,
  PreviewError,
  TrustedPreviewContent,
} from './types';
import type { NextraPageMeta } from '@mdx-preview/shared';
import { useTheme } from './theme';
import {
  ZOOM_MIN_PERCENT,
  ZOOM_MAX_PERCENT,
  ZOOM_STEP_PERCENT,
  ZOOM_DEFAULT_PERCENT,
} from './constants';
import {
  useFieldSetter,
  useFieldResetter,
  useFieldSetterWithFormat,
} from './hooks';
import './App.css';
import './styles/admonitions.css';
import './components/shims/docusaurus/styles.css';
import './components/shims/starlight/styles.css';
import './components/shims/nextra/styles.css';

debug('[APP] App.tsx module loaded');

// initial trust state (Safe Mode by default)
const INITIAL_TRUST_STATE: TrustState = {
  workspaceTrusted: false,
  scriptsEnabled: false,
  canExecute: false,
  openMdxLinksInPreview: true,
};

// app state interface
interface AppState {
  trustState: TrustState;
  content: PreviewContent | null;
  error: PreviewError | null;
  isLoading: boolean;
  // evaluated MDX component for Trusted Mode
  evaluatedComponent: ComponentType | null;
  // whether preview content is stale
  isStale: boolean;
  // zoom level (percentage, 100 = 100%)
  zoomLevel: number;
  // Nextra page metadata (title, layout, etc.)
  nextraMeta: NextraPageMeta | null;
}

function App() {
  debug('[APP] App component rendering');

  const [state, setState] = useState<AppState>({
    trustState: INITIAL_TRUST_STATE,
    content: null,
    error: null,
    isLoading: true,
    evaluatedComponent: null,
    isStale: false,
    zoomLevel: ZOOM_DEFAULT_PERCENT,
    nextraMeta: null,
  });

  // track if we've completed initial setup
  const initializedRef = useRef(false);

  // get theme context for MPE preview themes
  const { previewTheme, setPreviewThemeState } = useTheme();

  // simple field setters using factory hooks
  const setTrustState = useFieldSetter(setState, 'trustState', 'APP');

  // set Safe Mode content (called by RPC handler)
  const setSafeContent = useCallback((html: string) => {
    debug(`[APP] setSafeContent called, html length: ${html.length}`);
    setState((prev) => ({
      ...prev,
      content: { mode: 'safe', html },
      error: null,
      isLoading: false,
      evaluatedComponent: null,
    }));
  }, []);

  // set Trusted Mode content (called by RPC handler) - component evaluation happens in TrustedPreviewRenderer
  const setTrustedContent = useCallback(
    (code: string, entryFilePath: string, dependencies: string[]) => {
      debug(
        `[APP] setTrustedContent called, code length: ${code.length}, path: ${entryFilePath}`
      );
      setState((prev) => ({
        ...prev,
        content: {
          mode: 'trusted',
          code,
          entryFilePath,
          dependencies,
        },
        error: null,
        isLoading: false,
        // will be set after evaluation
        evaluatedComponent: null,
      }));
    },
    []
  );

  // set error state (called by RPC handler or on evaluation error)
  const setError = useCallback((error: PreviewError) => {
    debug('[APP] setError called', error);
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }));
  }, []);

  // clear error & retry
  const clearError = useFieldResetter(setState, 'error', null, 'APP', 'clearError');

  // set evaluated component after Trusted Mode evaluation
  const setEvaluatedComponent = useFieldSetterWithFormat(
    setState,
    'evaluatedComponent',
    'APP',
    (comp) => `setEvaluatedComponent called, ${comp ? 'has component' : 'null'}`
  );

  // set stale indicator state
  const setStale = useFieldSetter(setState, 'isStale', 'APP');

  // set Nextra page metadata (called by RPC handler)
  const setNextraMeta = useFieldSetter(setState, 'nextraMeta', 'APP');

  // zoom controls
  const zoomIn = useCallback(() => {
    debug('[APP] zoomIn called');
    setState((prev) => ({
      ...prev,
      zoomLevel: Math.min(ZOOM_MAX_PERCENT, prev.zoomLevel + ZOOM_STEP_PERCENT),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    debug('[APP] zoomOut called');
    setState((prev) => ({
      ...prev,
      zoomLevel: Math.max(ZOOM_MIN_PERCENT, prev.zoomLevel - ZOOM_STEP_PERCENT),
    }));
  }, []);

  const resetZoom = useFieldResetter(
    setState,
    'zoomLevel',
    ZOOM_DEFAULT_PERCENT,
    'APP',
    'resetZoom'
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

    // only handle external links with Ctrl/Cmd+click
    if (linkType === 'external') {
      const isModifierClick = event.metaKey || event.ctrlKey;
      if (!isModifierClick) {
        return;
      }

      event.preventDefault();
      debug(`[APP] Ctrl/Cmd+click external link: ${href}`);
      ExtensionHandle.openExternal(href);
    }
  }, []);

  // register RPC handlers on mount
  useEffect(() => {
    debug(
      '[APP] useEffect running, initializedRef.current:',
      initializedRef.current
    );
    if (initializedRef.current) {
      debug('[APP] Already initialized, skipping');
      return;
    }
    initializedRef.current = true;

    debug('[APP] Registering webview handlers...');
    registerWebviewHandlers({
      setTrustState,
      setSafeContent,
      setTrustedContent,
      setError,
      setStale,
      setTheme: setPreviewThemeState,
      setNextraMeta,
      zoomIn,
      zoomOut,
      resetZoom,
    });
    debug('[APP] Webview handlers registered');
  }, [
    setTrustState,
    setSafeContent,
    setTrustedContent,
    setError,
    setStale,
    setPreviewThemeState,
    setNextraMeta,
    zoomIn,
    zoomOut,
    resetZoom,
  ]);

  // destructure state for rendering
  const {
    trustState,
    content,
    error,
    isLoading,
    evaluatedComponent,
    isStale,
    zoomLevel,
    nextraMeta,
  } = state;
  debug(
    `[APP] Render state: isLoading=${isLoading}, content=${content?.mode ?? 'null'}, error=${error ? 'yes' : 'no'}, isStale=${isStale}`
  );

  // compute Nextra layout class from metadata
  const nextraLayoutClass = nextraMeta?.layout === 'full'
    ? 'nextra-layout-full'
    : nextraMeta?.layout === 'raw'
    ? 'nextra-layout-raw'
    : '';

  // render loading state during initial load
  if (isLoading && !content && !error) {
    debug('[APP] Rendering LoadingBar (initial loading)');
    return <LoadingBar />;
  }

  // render error state w/ unified ErrorDisplay component
  if (error) {
    debug('[APP] Rendering error state');
    // Convert PreviewError to Error for ErrorDisplay
    const errorObj = new Error(error.message);
    if (error.stack) {
      errorObj.stack = error.stack;
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
    debug('[APP] Rendering LoadingBar (no content)');
    return <LoadingBar />;
  }

  // render preview content in Safe or Trusted Mode
  debug(`[APP] Rendering content in ${content.mode} mode`);

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
        <div
          className="mdx-preview-content"
          style={
            zoomLevel !== ZOOM_DEFAULT_PERCENT
              ? {
                  transform: `scale(${zoomLevel / ZOOM_DEFAULT_PERCENT})`,
                  transformOrigin: 'top center',
                }
              : undefined
          }
        >
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

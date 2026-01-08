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
import { MDXErrorBoundary } from './components/ErrorBoundary';
import { TrustBanner } from './components/TrustBanner/TrustBanner';
import { StaleIndicator } from './components/StaleIndicator';
import { FrontmatterDisplay } from './components/FrontmatterDisplay';
import { SafePreviewRenderer } from './SafePreview';
import { TrustedPreviewRenderer } from './TrustedPreview';
import { registerWebviewHandlers, ExtensionHandle } from './rpc-webview';
import { debug } from './utils/debug';
import {
  classifyLink,
  normalizeRelativePath,
  extractAnchor,
} from './utils/linkHandler';
import type {
  TrustState,
  PreviewContent,
  PreviewError,
  TrustedPreviewContent,
} from './types';
import { useTheme } from './context/ThemeContext';
import './App.css';

debug('[APP] App.tsx module loaded');

// initial trust state (Safe Mode by default)
const INITIAL_TRUST_STATE: TrustState = {
  workspaceTrusted: false,
  scriptsEnabled: false,
  canExecute: false,
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
  });

  // track if we've completed initial setup
  const initializedRef = useRef(false);

  // ref for content container (used by scroll sync)
  const contentRef = useRef<HTMLDivElement>(null);

  // get theme context for MPE preview themes
  const { previewTheme, setPreviewThemeState } = useTheme();

  // set trust state (called by RPC handler)
  const setTrustState = useCallback((trustState: TrustState) => {
    debug('[APP] setTrustState called', trustState);
    setState((prev) => ({ ...prev, trustState }));
  }, []);

  // set Safe Mode content (called by RPC handler)
  const setSafeContent = useCallback(
    (html: string, frontmatter?: Record<string, unknown>) => {
      debug(`[APP] setSafeContent called, html length: ${html.length}`);
      setState((prev) => ({
        ...prev,
        content: { mode: 'safe', html, frontmatter },
        error: null,
        isLoading: false,
        evaluatedComponent: null,
      }));
    },
    []
  );

  // set Trusted Mode content (called by RPC handler) - component evaluation happens in TrustedPreviewRenderer
  const setTrustedContent = useCallback(
    (
      code: string,
      entryFilePath: string,
      dependencies: string[],
      frontmatter?: Record<string, unknown>
    ) => {
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
          frontmatter,
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
  const clearError = useCallback(() => {
    debug('[APP] clearError called');
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // set evaluated component after Trusted Mode evaluation
  const setEvaluatedComponent = useCallback(
    (component: ComponentType | null) => {
      debug(
        '[APP] setEvaluatedComponent called',
        component ? 'has component' : 'null'
      );
      setState((prev) => ({
        ...prev,
        evaluatedComponent: component,
      }));
    },
    []
  );

  // set stale indicator state
  const setStale = useCallback((isStale: boolean) => {
    debug('[APP] setStale called', isStale);
    setState((prev) => ({
      ...prev,
      isStale,
    }));
  }, []);

  // handle link clicks - intercept Ctrl/Cmd+clicks on anchors & route appropriately (regular clicks not intercepted for text selection)
  const handleLinkClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    // find closest anchor element
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

    // anchor links (internal page navigation) work without modifier
    if (linkType === 'anchor') {
      event.preventDefault();
      const anchorId = extractAnchor(href);
      if (anchorId) {
        const targetEl = document.getElementById(anchorId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return;
    }

    // external & relative-file links require Ctrl/Cmd+click
    const isModifierClick = event.metaKey || event.ctrlKey;
    if (!isModifierClick) {
      // no modifier - let default behavior (CSP will block navigation)
      debug(`[APP] Link click without modifier, ignoring: ${href}`);
      return;
    }

    debug(`[APP] Ctrl/Cmd+click: ${href} (type: ${linkType})`);

    switch (linkType) {
      case 'external': {
        // open external URL via extension (more secure than direct navigation)
        event.preventDefault();
        ExtensionHandle.openExternal(href);
        break;
      }

      case 'relative-file': {
        // open relative file in editor
        event.preventDefault();
        const filePath = normalizeRelativePath(href);
        ExtensionHandle.openDocument(filePath);
        break;
      }

      case 'unknown':
      default: {
        // let browser handle unknown links (will likely be blocked by CSP)
        debug(`[APP] Unknown link type, not intercepting: ${href}`);
        break;
      }
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
      // theme handler
      setTheme: setPreviewThemeState,
    });
    debug('[APP] Webview handlers registered');
  }, [
    setTrustState,
    setSafeContent,
    setTrustedContent,
    setError,
    setStale,
    setPreviewThemeState,
  ]);

  // render based on state
  const { trustState, content, error, isLoading, evaluatedComponent, isStale } =
    state;
  debug(
    `[APP] Render state: isLoading=${isLoading}, content=${content?.mode ?? 'null'}, error=${error ? 'yes' : 'no'}, isStale=${isStale}`
  );

  // show loading state
  if (isLoading && !content && !error) {
    debug('[APP] Rendering LoadingBar (initial loading)');
    return <LoadingBar />;
  }

  // show error state
  if (error) {
    debug('[APP] Rendering error state');
    return (
      <div className="mdx-preview-container">
        <div className="mdx-preview-error">
          <div className="mdx-error-header">
            <span className="mdx-error-icon">!</span>
            <h2>Preview Error</h2>
          </div>
          <pre className="mdx-error-message">{error.message}</pre>
          {error.stack && (
            <details>
              <summary>Stack Trace</summary>
              <pre className="mdx-error-stack">{error.stack}</pre>
            </details>
          )}
          <button onClick={clearError} className="mdx-retry-button">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // no content yet
  if (!content) {
    debug('[APP] Rendering LoadingBar (no content)');
    return <LoadingBar />;
  }

  // render content based on mode
  debug(`[APP] Rendering content in ${content.mode} mode`);

  // extract frontmatter for display
  const frontmatter = content.frontmatter;
  const hasFrontmatter = frontmatter && Object.keys(frontmatter).length > 0;

  return (
    <div
      className="mdx-preview-container"
      onClick={handleLinkClick}
      data-mpe-theme-active={previewTheme !== 'none' ? 'true' : undefined}
    >
      <StaleIndicator isStale={isStale} />
      {!trustState.canExecute && <TrustBanner trustState={trustState} />}
      <MDXErrorBoundary
        onError={(err) => setError({ message: err.message, stack: err.stack })}
      >
        <div ref={contentRef} className="mdx-preview-content">
          {/* frontmatter display (collapsed by default) */}
          {hasFrontmatter && <FrontmatterDisplay frontmatter={frontmatter} />}
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

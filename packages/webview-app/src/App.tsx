/**
 * MDX Preview App
 *
 * Single React root that manages all preview rendering.
 * Safe and Trusted mode content is rendered via React state,
 * eliminating DOM ownership conflicts and React root leaks.
 */

import { useState, useEffect, useCallback, useRef, ComponentType } from 'react';
import LoadingBar from './components/LoadingBar/LoadingBar';
import { MDXErrorBoundary } from './components/ErrorBoundary';
import { ModeBadge } from './components/ModeBadge';
import { SafePreviewRenderer } from './SafePreview';
import { TrustedPreviewRenderer } from './TrustedPreview';
import { registerWebviewHandlers } from './rpc-webview';
import type {
  TrustState,
  PreviewContent,
  PreviewError,
  TrustedPreviewContent,
} from './types';
import './App.css';

console.log('[APP] App.tsx module loaded');

/**
 * Initial trust state (Safe Mode by default).
 */
const INITIAL_TRUST_STATE: TrustState = {
  workspaceTrusted: false,
  scriptsEnabled: false,
  canExecute: false,
};

/**
 * App state interface.
 */
interface AppState {
  trustState: TrustState;
  content: PreviewContent | null;
  error: PreviewError | null;
  isLoading: boolean;
  /** Evaluated MDX component for Trusted Mode */
  evaluatedComponent: ComponentType | null;
}

function App() {
  console.log('[APP] App component rendering');

  const [state, setState] = useState<AppState>({
    trustState: INITIAL_TRUST_STATE,
    content: null,
    error: null,
    isLoading: true,
    evaluatedComponent: null,
  });

  // Track if we've completed initial setup
  const initializedRef = useRef(false);

  /**
   * Set trust state (called by RPC handler).
   */
  const setTrustState = useCallback((trustState: TrustState) => {
    console.log('[APP] setTrustState called', trustState);
    setState((prev) => ({ ...prev, trustState }));
  }, []);

  /**
   * Set Safe Mode content (called by RPC handler).
   */
  const setSafeContent = useCallback((html: string) => {
    console.log(`[APP] setSafeContent called, html length: ${html.length}`);
    setState((prev) => ({
      ...prev,
      content: { mode: 'safe', html },
      error: null,
      isLoading: false,
      evaluatedComponent: null,
    }));
  }, []);

  /**
   * Set Trusted Mode content (called by RPC handler).
   * The actual component evaluation happens in TrustedPreviewRenderer.
   */
  const setTrustedContent = useCallback(
    (code: string, entryFilePath: string, dependencies: string[]) => {
      console.log(
        `[APP] setTrustedContent called, code length: ${code.length}, path: ${entryFilePath}`
      );
      setState((prev) => ({
        ...prev,
        content: { mode: 'trusted', code, entryFilePath, dependencies },
        error: null,
        isLoading: false,
        evaluatedComponent: null, // Will be set after evaluation
      }));
    },
    []
  );

  /**
   * Set error state (called by RPC handler or on evaluation error).
   */
  const setError = useCallback((error: PreviewError) => {
    console.log('[APP] setError called', error);
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }));
  }, []);

  /**
   * Clear error and retry.
   */
  const clearError = useCallback(() => {
    console.log('[APP] clearError called');
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Set the evaluated component after Trusted Mode evaluation.
   */
  const setEvaluatedComponent = useCallback(
    (component: ComponentType | null) => {
      console.log(
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

  /**
   * Register RPC handlers on mount.
   */
  useEffect(() => {
    console.log(
      '[APP] useEffect running, initializedRef.current:',
      initializedRef.current
    );
    if (initializedRef.current) {
      console.log('[APP] Already initialized, skipping');
      return;
    }
    initializedRef.current = true;

    console.log('[APP] Registering webview handlers...');
    registerWebviewHandlers({
      setTrustState,
      setSafeContent,
      setTrustedContent,
      setError,
    });
    console.log('[APP] Webview handlers registered');
  }, [setTrustState, setSafeContent, setTrustedContent, setError]);

  // Render based on state
  const { trustState, content, error, isLoading, evaluatedComponent } = state;
  console.log(
    `[APP] Render state: isLoading=${isLoading}, content=${content?.mode ?? 'null'}, error=${error ? 'yes' : 'no'}`
  );

  // Show loading state
  if (isLoading && !content && !error) {
    console.log('[APP] Rendering LoadingBar (initial loading)');
    return <LoadingBar />;
  }

  // Show error state
  if (error) {
    console.log('[APP] Rendering error state');
    return (
      <div className="mdx-preview-container">
        <ModeBadge trustState={trustState} />
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

  // No content yet
  if (!content) {
    console.log('[APP] Rendering LoadingBar (no content)');
    return <LoadingBar />;
  }

  // Render content based on mode
  console.log(`[APP] Rendering content in ${content.mode} mode`);
  return (
    <div className="mdx-preview-container">
      <ModeBadge trustState={trustState} />
      <MDXErrorBoundary
        onError={(err) => setError({ message: err.message, stack: err.stack })}
      >
        <div className="mdx-preview-content">
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

// packages/webview-app/src/context/WebviewStateProvider.tsx
// Composite provider that wraps all state contexts and handles RPC handler registration

import { useEffect, useRef, type ReactNode } from 'react';
import { TrustProvider, useTrust } from './TrustContext';
import { PreviewProvider, usePreview } from './PreviewContext';
import { LoadingProvider, useLoading } from './LoadingContext';
import { ZoomProvider, useZoom } from './ZoomContext';
import { NextraProvider, useNextra } from './NextraContext';
import { useTheme } from '../theme';
import { registerWebviewHandlers } from '../rpc-webview';
import { debug } from '../utils/debug';

interface HandlerRegistrarProps {
  children: ReactNode;
}

// wrap a setter to also clear loading state after calling it
function wrapWithLoadingClear<Args extends unknown[]>(
  setter: (...args: Args) => void,
  clearLoading: () => void
): (...args: Args) => void {
  return (...args) => {
    setter(...args);
    clearLoading();
  };
}

// internal component that registers RPC handlers after all contexts are mounted
function HandlerRegistrar({ children }: HandlerRegistrarProps) {
  const { setTrustState } = useTrust();
  const { setSafeContent, setTrustedContent, setError } = usePreview();
  const { setStale, setIsLoading } = useLoading();
  const { zoomIn, zoomOut, resetZoom } = useZoom();
  const { setNextraMeta } = useNextra();
  const { setPreviewThemeState } = useTheme();

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      debug('[WEBVIEW-STATE] Already initialized, skipping');
      return;
    }
    initializedRef.current = true;

    // helper to clear loading state after content updates
    const clearLoading = () => setIsLoading(false);

    debug('[WEBVIEW-STATE] Registering handlers...');
    registerWebviewHandlers({
      setTrustState,
      setSafeContent: wrapWithLoadingClear(setSafeContent, clearLoading),
      setTrustedContent: wrapWithLoadingClear(setTrustedContent, clearLoading),
      setError: wrapWithLoadingClear(setError, clearLoading),
      setStale,
      setTheme: setPreviewThemeState,
      setNextraMeta,
      zoomIn,
      zoomOut,
      resetZoom,
    });
    debug('[WEBVIEW-STATE] Handlers registered');
  }, [
    setTrustState,
    setSafeContent,
    setTrustedContent,
    setError,
    setStale,
    setIsLoading,
    setPreviewThemeState,
    setNextraMeta,
    zoomIn,
    zoomOut,
    resetZoom,
  ]);

  return <>{children}</>;
}

interface WebviewStateProviderProps {
  children: ReactNode;
}

// composite provider that wraps all state contexts
// context order matters for re-render isolation:
// - outer contexts re-render less frequently
// - inner contexts can access outer context values
export function WebviewStateProvider({ children }: WebviewStateProviderProps) {
  return (
    <TrustProvider>
      <PreviewProvider>
        <LoadingProvider>
          <ZoomProvider>
            <NextraProvider>
              <HandlerRegistrar>{children}</HandlerRegistrar>
            </NextraProvider>
          </ZoomProvider>
        </LoadingProvider>
      </PreviewProvider>
    </TrustProvider>
  );
}

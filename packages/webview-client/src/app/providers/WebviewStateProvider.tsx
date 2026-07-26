// packages/webview-client/src/app/providers/WebviewStateProvider.tsx
// composite provider that wrap all state contexts & handle RPC handler registration

import { useEffect, useRef, type ReactNode } from 'react';
import { TrustProvider, useTrust } from '../state/TrustContext';
import { PreviewProvider, usePreview } from '../state/PreviewContext';
import { LoadingProvider, useLoading } from '../state/LoadingContext';
import { UIFlagsProvider, useUIFlags } from '../state/UIFlagsContext';
import { useTheme } from '../../features/theme/runtime';
import { registerWebviewHandlers } from '../../platform/rpc/webview-rpc-client';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.WEBVIEW_STATE);

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

// internal component that register RPC handlers after all contexts are mounted
function HandlerRegistrar({ children }: HandlerRegistrarProps) {
  const { setTrustState } = useTrust();
  const { setSafeContent, setTrustedContent, setError, setNextraMeta } =
    usePreview();
  const { setStale, setIsLoading } = useLoading();
  const { setRuntimeConfig, adjustZoom, resetZoom } = useUIFlags();
  const { setPreviewThemeState } = useTheme();

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      log.debug('Already initialized, skipping');
      return;
    }
    initializedRef.current = true;

    // helper to clear loading state after content updates
    const clearLoading = () => setIsLoading(false);

    log.debug('Registering handlers...');
    registerWebviewHandlers({
      setTrustState,
      setSafeContent: wrapWithLoadingClear(setSafeContent, clearLoading),
      setTrustedContent: wrapWithLoadingClear(setTrustedContent, clearLoading),
      setError: wrapWithLoadingClear(setError, clearLoading),
      setStale,
      setTheme: setPreviewThemeState,
      setNextraMeta,
      setRuntimeConfig,
      adjustZoom,
      resetZoom,
    });
    log.debug('Handlers registered');
  }, [
    setTrustState,
    setSafeContent,
    setTrustedContent,
    setError,
    setStale,
    setIsLoading,
    setPreviewThemeState,
    setNextraMeta,
    setRuntimeConfig,
    adjustZoom,
    resetZoom,
  ]);

  return <>{children}</>;
}

interface WebviewStateProviderProps {
  children: ReactNode;
}

// composite provider that wrap all state contexts
// context order matters for re-render isolation
export function WebviewStateProvider({ children }: WebviewStateProviderProps) {
  return (
    <TrustProvider>
      <PreviewProvider>
        <LoadingProvider>
          <UIFlagsProvider>
            <HandlerRegistrar>{children}</HandlerRegistrar>
          </UIFlagsProvider>
        </LoadingProvider>
      </PreviewProvider>
    </TrustProvider>
  );
}

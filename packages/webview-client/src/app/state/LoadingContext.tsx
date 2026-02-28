// packages/webview-client/src/app/state/LoadingContext.tsx
// React context for loading state - manage loading indicators & stale content state

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

interface LoadingContextValue {
  isLoading: boolean;
  isStale: boolean;
  setIsLoading: (loading: boolean) => void;
  setStale: (stale: boolean) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.LOADING_CONTEXT);

// hook that provide the Loading context value
function useLoadingProviderValue(): LoadingContextValue {
  const [isLoading, setIsLoadingState] = useState(true);
  const [isStale, setStaleState] = useState(false);

  const setIsLoading = useCallback((loading: boolean) => {
    log.debug(`setIsLoading called: ${loading}`);
    setIsLoadingState(loading);
  }, []);

  const setStale = useCallback((stale: boolean) => {
    log.debug(`setStale called: ${stale}`);
    setStaleState(stale);
  }, []);

  return useMemo(
    () => ({
      isLoading,
      isStale,
      setIsLoading,
      setStale,
    }),
    [isLoading, isStale, setIsLoading, setStale]
  );
}

const { Provider, useContextValue } =
  createContextProvider<LoadingContextValue>(
    'Loading',
    useLoadingProviderValue
  );

export const LoadingProvider = Provider;
export const useLoading = useContextValue;

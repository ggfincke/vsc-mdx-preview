// packages/webview-app/src/context/LoadingContext.tsx
// React context for loading state - manages loading indicators & stale content state

import { useState, useCallback, useMemo } from 'react';
import { debug } from '../utils/debug';
import { createContextProvider } from './createContextProvider';

interface LoadingContextValue {
  isLoading: boolean;
  isStale: boolean;
  setIsLoading: (loading: boolean) => void;
  setStale: (stale: boolean) => void;
}

// hook that provides the Loading context value
function useLoadingProviderValue(): LoadingContextValue {
  const [isLoading, setIsLoadingState] = useState(true);
  const [isStale, setStaleState] = useState(false);

  const setIsLoading = useCallback((loading: boolean) => {
    debug(`[LOADING-CONTEXT] setIsLoading called: ${loading}`);
    setIsLoadingState(loading);
  }, []);

  const setStale = useCallback((stale: boolean) => {
    debug(`[LOADING-CONTEXT] setStale called: ${stale}`);
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

const { Provider, useContextValue } = createContextProvider<LoadingContextValue>(
  'Loading',
  useLoadingProviderValue
);

export const LoadingProvider = Provider;
export const useLoading = useContextValue;

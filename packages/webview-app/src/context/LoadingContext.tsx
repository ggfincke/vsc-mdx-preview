// packages/webview-app/src/context/LoadingContext.tsx
// React context for loading state - manages loading indicators and stale content state

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { debug } from '../utils/debug';

interface LoadingContextValue {
  isLoading: boolean;
  isStale: boolean;
  setIsLoading: (loading: boolean) => void;
  setStale: (stale: boolean) => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
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

  const value = useMemo(
    () => ({
      isLoading,
      isStale,
      setIsLoading,
      setStale,
    }),
    [isLoading, isStale, setIsLoading, setStale]
  );

  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}

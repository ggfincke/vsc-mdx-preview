// packages/webview-app/src/context/PreviewContext.tsx
// React context for preview content state - manages MDX content, errors & evaluated components

import { useState, useCallback, useMemo } from 'react';
import type { PreviewContent, PreviewError } from '../types';
import { debug } from '../utils/debug';
import { createContextProvider } from './createContextProvider';

interface PreviewContextValue {
  content: PreviewContent | null;
  error: PreviewError | null;
  setSafeContent: (html: string) => void;
  setTrustedContent: (code: string, entryFilePath: string, dependencies: string[]) => void;
  setError: (error: PreviewError) => void;
  clearError: () => void;
}

// hook that provides the Preview context value
function usePreviewProviderValue(): PreviewContextValue {
  const [content, setContent] = useState<PreviewContent | null>(null);
  const [error, setErrorState] = useState<PreviewError | null>(null);

  const setSafeContent = useCallback((html: string) => {
    debug(`[PREVIEW-CONTEXT] setSafeContent called, html length: ${html.length}`);
    setContent({ mode: 'safe', html });
    setErrorState(null);
  }, []);

  const setTrustedContent = useCallback(
    (code: string, entryFilePath: string, dependencies: string[]) => {
      debug(
        `[PREVIEW-CONTEXT] setTrustedContent called, code length: ${code.length}, path: ${entryFilePath}`
      );
      setContent({ mode: 'trusted', code, entryFilePath, dependencies });
      setErrorState(null);
    },
    []
  );

  const setError = useCallback((error: PreviewError) => {
    debug('[PREVIEW-CONTEXT] setError called', error);
    setErrorState(error);
  }, []);

  const clearError = useCallback(() => {
    debug('[PREVIEW-CONTEXT] clearError called');
    setErrorState(null);
  }, []);

  return useMemo(
    () => ({
      content,
      error,
      setSafeContent,
      setTrustedContent,
      setError,
      clearError,
    }),
    [
      content,
      error,
      setSafeContent,
      setTrustedContent,
      setError,
      clearError,
    ]
  );
}

const { Provider, useContextValue } = createContextProvider<PreviewContextValue>(
  'Preview',
  usePreviewProviderValue
);

export const PreviewProvider = Provider;
export const usePreview = useContextValue;

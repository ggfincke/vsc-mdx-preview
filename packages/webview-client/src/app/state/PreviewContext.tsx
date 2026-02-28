// packages/webview-client/src/app/state/PreviewContext.tsx
// React context for preview content state - manage MDX content, errors & evaluated components

import { useState, useCallback, useMemo } from 'react';
import type { PreviewContent, PreviewError } from '../types';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { LogTags } from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

interface PreviewContextValue {
  content: PreviewContent | null;
  error: PreviewError | null;
  setSafeContent: (html: string) => void;
  setTrustedContent: (
    code: string,
    entryFilePath: string,
    dependencies: string[]
  ) => void;
  setError: (error: PreviewError) => void;
  clearError: () => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.PREVIEW_CONTEXT);

// hook that provide the Preview context value
function usePreviewProviderValue(): PreviewContextValue {
  const [content, setContent] = useState<PreviewContent | null>(null);
  const [error, setErrorState] = useState<PreviewError | null>(null);

  const setSafeContent = useCallback((html: string) => {
    log.debug(`setSafeContent called, html length: ${html.length}`);
    setContent({ mode: 'safe', html });
    setErrorState(null);
  }, []);

  const setTrustedContent = useCallback(
    (code: string, entryFilePath: string, dependencies: string[]) => {
      log.debug(
        `setTrustedContent called, code length: ${code.length}, path: ${entryFilePath}`
      );
      setContent({ mode: 'trusted', code, entryFilePath, dependencies });
      setErrorState(null);
    },
    []
  );

  const setError = useCallback((error: PreviewError) => {
    log.debug('setError called', error);
    setErrorState(error);
  }, []);

  const clearError = useCallback(() => {
    log.debug('clearError called');
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
    [content, error, setSafeContent, setTrustedContent, setError, clearError]
  );
}

const { Provider, useContextValue } =
  createContextProvider<PreviewContextValue>(
    'Preview',
    usePreviewProviderValue
  );

export const PreviewProvider = Provider;
export const usePreview = useContextValue;

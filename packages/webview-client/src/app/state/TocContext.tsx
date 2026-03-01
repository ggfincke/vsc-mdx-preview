// packages/webview-client/src/app/state/TocContext.tsx
// React context for preview runtime UI flags

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import {
  LogTags,
  type SourceLineHighlightColorValue,
} from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

interface TocContextValue {
  sourceLineHighlightEnabled: boolean;
  sourceLineHighlightColorMode: SourceLineHighlightColorValue;
  shimSideRailEnabled: boolean;
  setSourceLineHighlight: (enabled: boolean) => void;
  setSourceLineHighlightColor: (mode: SourceLineHighlightColorValue) => void;
  setShimSideRail: (enabled: boolean) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

// hook that provides the TOC context value
function useTocProviderValue(): TocContextValue {
  const [sourceLineHighlightEnabled, setSourceLineHighlightEnabledState] =
    useState(true);
  const [sourceLineHighlightColorMode, setSourceLineHighlightColorModeState] =
    useState<SourceLineHighlightColorValue>('dependent');
  const [shimSideRailEnabled, setShimSideRailEnabledState] = useState(true);

  const setSourceLineHighlight = useCallback((enabled: boolean) => {
    log.debug('setSourceLineHighlight called', enabled);
    setSourceLineHighlightEnabledState(enabled);
  }, []);

  const setSourceLineHighlightColor = useCallback(
    (mode: SourceLineHighlightColorValue) => {
      log.debug('setSourceLineHighlightColor called', mode);
      setSourceLineHighlightColorModeState(mode);
    },
    []
  );

  const setShimSideRail = useCallback((enabled: boolean) => {
    log.debug('setShimSideRail called', enabled);
    setShimSideRailEnabledState(enabled);
  }, []);

  return useMemo(
    () => ({
      sourceLineHighlightEnabled,
      sourceLineHighlightColorMode,
      shimSideRailEnabled,
      setSourceLineHighlight,
      setSourceLineHighlightColor,
      setShimSideRail,
    }),
    [
      sourceLineHighlightEnabled,
      sourceLineHighlightColorMode,
      shimSideRailEnabled,
      setSourceLineHighlight,
      setSourceLineHighlightColor,
      setShimSideRail,
    ]
  );
}

const { Provider, useContextValue } = createContextProvider<TocContextValue>(
  'Toc',
  useTocProviderValue
);

export const TocProvider = Provider;
export const useToc = useContextValue;

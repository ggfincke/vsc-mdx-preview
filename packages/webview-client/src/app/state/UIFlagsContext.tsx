// packages/webview-client/src/app/state/UIFlagsContext.tsx
// React context for preview runtime UI flags

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import {
  LogTags,
  type SourceLineHighlightColorValue,
} from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

interface UIFlagsContextValue {
  sourceLineHighlightEnabled: boolean;
  sourceLineHighlightColorMode: SourceLineHighlightColorValue;
  shimSideRailEnabled: boolean;
  setSourceLineHighlight: (enabled: boolean) => void;
  setSourceLineHighlightColor: (mode: SourceLineHighlightColorValue) => void;
  setShimSideRail: (enabled: boolean) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

// hook that provides the UI flags context value
function useUIFlagsProviderValue(): UIFlagsContextValue {
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

const { Provider, useContextValue } =
  createContextProvider<UIFlagsContextValue>(
    'UIFlags',
    useUIFlagsProviderValue
  );

export const UIFlagsProvider = Provider;
export const useUIFlags = useContextValue;

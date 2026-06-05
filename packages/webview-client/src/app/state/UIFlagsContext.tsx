// packages/webview-client/src/app/state/UIFlagsContext.tsx
// React context for preview runtime UI flags

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import {
  clampToHundredths,
  roundToHundredths,
} from '../../shared/utils/clamp';
import {
  getItem,
  setItem,
  removeItem,
} from '../../shared/utils/safeLocalStorage';
import {
  LogTags,
  type PreviewScrollSyncValue,
  type SourceLineHighlightColorValue,
} from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

const ZOOM_STORAGE_KEY = 'mdx-preview.zoom-level';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;

// read persisted zoom from localStorage w/ validation
function readPersistedZoom(): number {
  const stored = getItem(ZOOM_STORAGE_KEY);
  if (stored) {
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && parsed >= ZOOM_MIN && parsed <= ZOOM_MAX) {
      return roundToHundredths(parsed);
    }
  }
  return ZOOM_DEFAULT;
}

// persist zoom to localStorage
function persistZoom(level: number): void {
  if (level === ZOOM_DEFAULT) {
    removeItem(ZOOM_STORAGE_KEY);
  } else {
    setItem(ZOOM_STORAGE_KEY, String(level));
  }
}

interface UIFlagsContextValue {
  sourceLineHighlightEnabled: boolean;
  sourceLineHighlightColorMode: SourceLineHighlightColorValue;
  scrollSyncMode: PreviewScrollSyncValue;
  shimSideRailEnabled: boolean;
  zoomLevel: number;
  setSourceLineHighlight: (enabled: boolean) => void;
  setSourceLineHighlightColor: (mode: SourceLineHighlightColorValue) => void;
  setScrollSync: (mode: PreviewScrollSyncValue) => void;
  setShimSideRail: (enabled: boolean) => void;
  setZoomLevel: (level: number) => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

// hook that provides the UI flags context value
function useUIFlagsProviderValue(): UIFlagsContextValue {
  const [sourceLineHighlightEnabled, setSourceLineHighlightEnabledState] =
    useState(true);
  const [sourceLineHighlightColorMode, setSourceLineHighlightColorModeState] =
    useState<SourceLineHighlightColorValue>('dependent');
  const [scrollSyncMode, setScrollSyncMode] =
    useState<PreviewScrollSyncValue>('off');
  const [shimSideRailEnabled, setShimSideRailEnabledState] = useState(true);
  const [zoomLevel, setZoomLevelState] = useState(readPersistedZoom);

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

  const setScrollSync = useCallback((mode: PreviewScrollSyncValue) => {
    log.debug('setScrollSync called', mode);
    setScrollSyncMode(mode);
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    const clamped = clampToHundredths(level, ZOOM_MIN, ZOOM_MAX);
    log.debug('setZoomLevel called', clamped);
    setZoomLevelState(clamped);
    persistZoom(clamped);
  }, []);

  return useMemo(
    () => ({
      sourceLineHighlightEnabled,
      sourceLineHighlightColorMode,
      scrollSyncMode,
      shimSideRailEnabled,
      zoomLevel,
      setSourceLineHighlight,
      setSourceLineHighlightColor,
      setScrollSync,
      setShimSideRail,
      setZoomLevel,
    }),
    [
      sourceLineHighlightEnabled,
      sourceLineHighlightColorMode,
      scrollSyncMode,
      shimSideRailEnabled,
      zoomLevel,
      setSourceLineHighlight,
      setSourceLineHighlightColor,
      setScrollSync,
      setShimSideRail,
      setZoomLevel,
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

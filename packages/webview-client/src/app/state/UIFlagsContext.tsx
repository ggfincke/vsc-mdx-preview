// packages/webview-client/src/app/state/UIFlagsContext.tsx
// React context for preview runtime UI flags

import { useState, useCallback, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import {
  LogTags,
  type SourceLineHighlightColorValue,
} from '@mdx-preview/contracts';
import { createContextProvider } from '../providers/createContextProvider';

const ZOOM_STORAGE_KEY = 'mdx-preview.zoom-level';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;

// read persisted zoom from localStorage w/ validation
function readPersistedZoom(): number {
  try {
    const stored = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= ZOOM_MIN && parsed <= ZOOM_MAX) {
        return Math.round(parsed * 100) / 100;
      }
    }
  } catch {
    // ignore storage failures
  }
  return ZOOM_DEFAULT;
}

// persist zoom to localStorage
function persistZoom(level: number): void {
  try {
    if (level === ZOOM_DEFAULT) {
      window.localStorage.removeItem(ZOOM_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
    }
  } catch {
    // ignore storage failures
  }
}

interface UIFlagsContextValue {
  sourceLineHighlightEnabled: boolean;
  sourceLineHighlightColorMode: SourceLineHighlightColorValue;
  shimSideRailEnabled: boolean;
  zoomLevel: number;
  setSourceLineHighlight: (enabled: boolean) => void;
  setSourceLineHighlightColor: (mode: SourceLineHighlightColorValue) => void;
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

  const setZoomLevel = useCallback((level: number) => {
    const clamped = Math.round(
      Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level)) * 100
    ) / 100;
    log.debug('setZoomLevel called', clamped);
    setZoomLevelState(clamped);
    persistZoom(clamped);
  }, []);

  return useMemo(
    () => ({
      sourceLineHighlightEnabled,
      sourceLineHighlightColorMode,
      shimSideRailEnabled,
      zoomLevel,
      setSourceLineHighlight,
      setSourceLineHighlightColor,
      setShimSideRail,
      setZoomLevel,
    }),
    [
      sourceLineHighlightEnabled,
      sourceLineHighlightColorMode,
      shimSideRailEnabled,
      zoomLevel,
      setSourceLineHighlight,
      setSourceLineHighlightColor,
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

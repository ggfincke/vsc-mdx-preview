// packages/webview-client/src/app/state/UIFlagsContext.tsx
// React context for preview runtime UI flags

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createTaggedLogger } from '../../shared/utils/createTaggedLogger';
import { clampToHundredths, roundToHundredths } from '../../shared/utils/clamp';
import {
  getItem,
  setItem,
  removeItem,
} from '../../shared/utils/safeLocalStorage';
import {
  LogTags,
  SETTINGS_DEFAULTS,
  type PreviewRuntimeConfig,
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
  sourceLineHighlightEnabled: PreviewRuntimeConfig['sourceLineHighlight'];
  sourceLineHighlightColorMode: PreviewRuntimeConfig['sourceLineHighlightColor'];
  scrollSyncMode: PreviewRuntimeConfig['scrollSync'];
  shimSideRailEnabled: PreviewRuntimeConfig['shimSideRail'];
  zoomLevel: number;
  setRuntimeConfig: (config: PreviewRuntimeConfig) => void;
  adjustZoom: (delta: number) => void;
  resetZoom: () => void;
}

// module-level tagged logger (avoids per-render allocation)
const log = createTaggedLogger(LogTags.APP);

// hook that provides the UI flags context value
function useUIFlagsProviderValue(): UIFlagsContextValue {
  const [runtimeConfig, setRuntimeConfigState] = useState<PreviewRuntimeConfig>(
    {
      sourceLineHighlight: SETTINGS_DEFAULTS['preview.sourceLineHighlight'],
      sourceLineHighlightColor:
        SETTINGS_DEFAULTS['preview.sourceLineHighlightColor'],
      scrollSync: SETTINGS_DEFAULTS['preview.scrollSync'],
      shimSideRail: SETTINGS_DEFAULTS['preview.shimSideRail'],
    }
  );
  const [zoomLevel, setZoomLevelState] = useState(readPersistedZoom);

  const setRuntimeConfig = useCallback((config: PreviewRuntimeConfig) => {
    log.debug('setRuntimeConfig called', config);
    setRuntimeConfigState(config);
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setZoomLevelState((level) => {
      const adjusted = clampToHundredths(level + delta, ZOOM_MIN, ZOOM_MAX);
      log.debug('adjustZoom called', adjusted);
      return adjusted;
    });
  }, []);

  const resetZoom = useCallback(() => {
    log.debug('resetZoom called');
    persistZoom(ZOOM_DEFAULT);
    setZoomLevelState(ZOOM_DEFAULT);
  }, []);

  useEffect(() => {
    persistZoom(zoomLevel);
  }, [zoomLevel]);

  return useMemo(
    () => ({
      sourceLineHighlightEnabled: runtimeConfig.sourceLineHighlight,
      sourceLineHighlightColorMode: runtimeConfig.sourceLineHighlightColor,
      scrollSyncMode: runtimeConfig.scrollSync,
      shimSideRailEnabled: runtimeConfig.shimSideRail,
      zoomLevel,
      setRuntimeConfig,
      adjustZoom,
      resetZoom,
    }),
    [runtimeConfig, zoomLevel, setRuntimeConfig, adjustZoom, resetZoom]
  );
}

const { Provider, useContextValue } =
  createContextProvider<UIFlagsContextValue>(
    'UIFlags',
    useUIFlagsProviderValue
  );

export const UIFlagsProvider = Provider;
export const useUIFlags = useContextValue;

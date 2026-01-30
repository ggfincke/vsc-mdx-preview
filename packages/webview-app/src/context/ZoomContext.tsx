// packages/webview-app/src/context/ZoomContext.tsx
// React context for zoom state - manages preview zoom level

import { useState, useCallback, useMemo } from 'react';
import {
  ZOOM_MIN_PERCENT,
  ZOOM_MAX_PERCENT,
  ZOOM_STEP_PERCENT,
  ZOOM_DEFAULT_PERCENT,
} from '../constants';
import { debug } from '../utils/debug';
import { LogTags } from '@mdx-preview/shared';
import { createContextProvider } from './createContextProvider';

interface ZoomContextValue {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

// hook that provides the Zoom context value
function useZoomProviderValue(): ZoomContextValue {
  const [zoomLevel, setZoomLevel] = useState(ZOOM_DEFAULT_PERCENT);

  const zoomIn = useCallback(() => {
    debug(`[${LogTags.ZOOM_CONTEXT}] zoomIn called`);
    setZoomLevel((prev) => Math.min(ZOOM_MAX_PERCENT, prev + ZOOM_STEP_PERCENT));
  }, []);

  const zoomOut = useCallback(() => {
    debug(`[${LogTags.ZOOM_CONTEXT}] zoomOut called`);
    setZoomLevel((prev) => Math.max(ZOOM_MIN_PERCENT, prev - ZOOM_STEP_PERCENT));
  }, []);

  const resetZoom = useCallback(() => {
    debug(`[${LogTags.ZOOM_CONTEXT}] resetZoom called`);
    setZoomLevel(ZOOM_DEFAULT_PERCENT);
  }, []);

  return useMemo(
    () => ({
      zoomLevel,
      zoomIn,
      zoomOut,
      resetZoom,
    }),
    [zoomLevel, zoomIn, zoomOut, resetZoom]
  );
}

const { Provider, useContextValue } = createContextProvider<ZoomContextValue>(
  'Zoom',
  useZoomProviderValue
);

export const ZoomProvider = Provider;
export const useZoom = useContextValue;

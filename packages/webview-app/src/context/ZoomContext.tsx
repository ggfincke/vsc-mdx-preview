// packages/webview-app/src/context/ZoomContext.tsx
// React context for zoom state - manages preview zoom level

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  ZOOM_MIN_PERCENT,
  ZOOM_MAX_PERCENT,
  ZOOM_STEP_PERCENT,
  ZOOM_DEFAULT_PERCENT,
} from '../constants';
import { debug } from '../utils/debug';

interface ZoomContextValue {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const ZoomContext = createContext<ZoomContextValue | null>(null);

interface ZoomProviderProps {
  children: ReactNode;
}

export function ZoomProvider({ children }: ZoomProviderProps) {
  const [zoomLevel, setZoomLevel] = useState(ZOOM_DEFAULT_PERCENT);

  const zoomIn = useCallback(() => {
    debug('[ZOOM-CONTEXT] zoomIn called');
    setZoomLevel((prev) => Math.min(ZOOM_MAX_PERCENT, prev + ZOOM_STEP_PERCENT));
  }, []);

  const zoomOut = useCallback(() => {
    debug('[ZOOM-CONTEXT] zoomOut called');
    setZoomLevel((prev) => Math.max(ZOOM_MIN_PERCENT, prev - ZOOM_STEP_PERCENT));
  }, []);

  const resetZoom = useCallback(() => {
    debug('[ZOOM-CONTEXT] resetZoom called');
    setZoomLevel(ZOOM_DEFAULT_PERCENT);
  }, []);

  const value = useMemo(
    () => ({
      zoomLevel,
      zoomIn,
      zoomOut,
      resetZoom,
    }),
    [zoomLevel, zoomIn, zoomOut, resetZoom]
  );

  return (
    <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>
  );
}

export function useZoom(): ZoomContextValue {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within ZoomProvider');
  }
  return context;
}

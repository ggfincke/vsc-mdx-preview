// packages/webview-client/src/app/state/LightboxContext.tsx
// React context for image lightbox w/ zoom, pan & gallery navigation

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { clampToHundredths } from '../../shared/utils/clamp';

export interface LightboxImage {
  src: string;
  alt?: string;
}

interface Offset {
  x: number;
  y: number;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;
const DEFAULT_OFFSET: Offset = { x: 0, y: 0 };

// clamp zoom & round to 2 decimal places to avoid floating-point drift
export function clampZoom(value: number): number {
  return clampToHundredths(value, ZOOM_MIN, ZOOM_MAX);
}

interface LightboxContextValue {
  // visibility & current image
  isOpen: boolean;
  currentImage: LightboxImage | null;
  openLightbox: (
    src: string,
    alt?: string,
    imageList?: LightboxImage[],
    index?: number
  ) => void;
  closeLightbox: () => void;
  // zoom & pan
  zoom: number;
  offset: Offset;
  setZoom: (zoom: number) => void;
  setOffset: (offset: Offset) => void;
  resetView: () => void;
  // gallery navigation
  imageList: LightboxImage[];
  currentIndex: number;
  navigateNext: () => void;
  navigatePrev: () => void;
}

// stable action callbacks only -> consumers skip re-renders on view-state churn
type LightboxActions = Pick<
  LightboxContextValue,
  | 'openLightbox'
  | 'closeLightbox'
  | 'setZoom'
  | 'setOffset'
  | 'resetView'
  | 'navigateNext'
  | 'navigatePrev'
>;

// hook that provides the Lightbox context value
function useLightboxProviderValue(): LightboxContextValue {
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<LightboxImage | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [offset, setOffsetState] = useState<Offset>(DEFAULT_OFFSET);
  const [imageList, setImageList] = useState<LightboxImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const imageListRef = useRef<LightboxImage[]>([]);

  const resetView = useCallback(() => {
    setZoomState(1);
    setOffsetState(DEFAULT_OFFSET);
  }, []);

  const openLightbox = useCallback(
    (
      src: string,
      alt?: string,
      list?: LightboxImage[],
      index?: number
    ) => {
      const images = list ?? [];
      setCurrentImage({ src, alt });
      setImageList(images);
      imageListRef.current = images;
      setCurrentIndex(index ?? 0);
      resetView();
      setIsOpen(true);
    },
    [resetView]
  );

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    // delay clearing state to allow fade-out animation
    setTimeout(() => {
      setCurrentImage(null);
      setImageList([]);
      imageListRef.current = [];
      setCurrentIndex(0);
      resetView();
    }, 200);
  }, [resetView]);

  const setZoom = useCallback((value: number) => {
    setZoomState(clampZoom(value));
  }, []);

  const setOffset = useCallback((value: Offset) => {
    setOffsetState(value);
  }, []);

  // shared gallery navigation w/ wrap-around in either direction
  const navigateBy = useCallback(
    (step: 1 | -1) => {
      const list = imageListRef.current;
      if (list.length <= 1) {
        return;
      }
      setCurrentIndex((prev) => {
        const next = (prev + step + list.length) % list.length;
        setCurrentImage(list[next]);
        return next;
      });
      resetView();
    },
    [resetView]
  );

  const navigateNext = useCallback(() => navigateBy(1), [navigateBy]);

  const navigatePrev = useCallback(() => navigateBy(-1), [navigateBy]);

  return useMemo(
    () => ({
      isOpen,
      currentImage,
      openLightbox,
      closeLightbox,
      zoom,
      offset,
      setZoom,
      setOffset,
      resetView,
      imageList,
      currentIndex,
      navigateNext,
      navigatePrev,
    }),
    [
      isOpen,
      currentImage,
      openLightbox,
      closeLightbox,
      zoom,
      offset,
      setZoom,
      setOffset,
      resetView,
      imageList,
      currentIndex,
      navigateNext,
      navigatePrev,
    ]
  );
}

// split contexts: full state for the lightbox UI, stable actions for preview renderers
const LightboxContext = createContext<LightboxContextValue | null>(null);
const LightboxActionsContext = createContext<LightboxActions | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const value = useLightboxProviderValue();

  // all callbacks are stable [] useCallbacks -> actions identity never changes
  const actions = useMemo<LightboxActions>(
    () => ({
      openLightbox: value.openLightbox,
      closeLightbox: value.closeLightbox,
      setZoom: value.setZoom,
      setOffset: value.setOffset,
      resetView: value.resetView,
      navigateNext: value.navigateNext,
      navigatePrev: value.navigatePrev,
    }),
    [
      value.openLightbox,
      value.closeLightbox,
      value.setZoom,
      value.setOffset,
      value.resetView,
      value.navigateNext,
      value.navigatePrev,
    ]
  );

  return (
    <LightboxActionsContext.Provider value={actions}>
      <LightboxContext.Provider value={value}>
        {children}
      </LightboxContext.Provider>
    </LightboxActionsContext.Provider>
  );
}

export function useLightbox(): LightboxContextValue {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error('useLightbox must be used within LightboxProvider');
  }
  return context;
}

export function useLightboxActions(): LightboxActions {
  const context = useContext(LightboxActionsContext);
  if (!context) {
    throw new Error('useLightboxActions must be used within LightboxProvider');
  }
  return context;
}

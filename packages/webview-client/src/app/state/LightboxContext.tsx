// packages/webview-client/src/app/state/LightboxContext.tsx
// React context for image lightbox w/ zoom, pan & gallery navigation

import { useState, useCallback, useMemo, useRef } from 'react';
import { createContextProvider } from '../providers/createContextProvider';

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
  return Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value)) * 100) / 100;
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
      setZoomState(1);
      setOffsetState(DEFAULT_OFFSET);
      setIsOpen(true);
    },
    []
  );

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    // delay clearing state to allow fade-out animation
    setTimeout(() => {
      setCurrentImage(null);
      setImageList([]);
      imageListRef.current = [];
      setCurrentIndex(0);
      setZoomState(1);
      setOffsetState(DEFAULT_OFFSET);
    }, 200);
  }, []);

  const setZoom = useCallback((value: number) => {
    setZoomState(clampZoom(value));
  }, []);

  const setOffset = useCallback((value: Offset) => {
    setOffsetState(value);
  }, []);

  const navigateNext = useCallback(() => {
    const list = imageListRef.current;
    if (list.length <= 1) {
      return;
    }
    setCurrentIndex((prev) => {
      const next = (prev + 1) % list.length;
      setCurrentImage(list[next]);
      return next;
    });
    setZoomState(1);
    setOffsetState(DEFAULT_OFFSET);
  }, []);

  const navigatePrev = useCallback(() => {
    const list = imageListRef.current;
    if (list.length <= 1) {
      return;
    }
    setCurrentIndex((prev) => {
      const next = (prev - 1 + list.length) % list.length;
      setCurrentImage(list[next]);
      return next;
    });
    setZoomState(1);
    setOffsetState(DEFAULT_OFFSET);
  }, []);

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

const { Provider, useContextValue } =
  createContextProvider<LightboxContextValue>(
    'Lightbox',
    useLightboxProviderValue
  );

export const LightboxProvider = Provider;
export const useLightbox = useContextValue;

// packages/webview-client/src/app/state/LightboxContext.tsx
// React context for image lightbox functionality

import { useState, useCallback, useMemo } from 'react';
import { createContextProvider } from '../providers/createContextProvider';

interface LightboxImage {
  src: string;
  alt?: string;
}

interface LightboxContextValue {
  isOpen: boolean;
  currentImage: LightboxImage | null;
  openLightbox: (src: string, alt?: string) => void;
  closeLightbox: () => void;
}

// hook that provide the Lightbox context value
function useLightboxProviderValue(): LightboxContextValue {
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<LightboxImage | null>(null);

  const openLightbox = useCallback((src: string, alt?: string) => {
    setCurrentImage({ src, alt });
    setIsOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    // delay clearing image to allow fade out animation
    setTimeout(() => {
      setCurrentImage(null);
    }, 200);
  }, []);

  return useMemo(
    () => ({
      isOpen,
      currentImage,
      openLightbox,
      closeLightbox,
    }),
    [isOpen, currentImage, openLightbox, closeLightbox]
  );
}

const { Provider, useContextValue } =
  createContextProvider<LightboxContextValue>(
    'Lightbox',
    useLightboxProviderValue
  );

export const LightboxProvider = Provider;
export const useLightbox = useContextValue;

// packages/webview-app/src/context/LightboxContext.tsx
// React context for image lightbox functionality

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

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

const LightboxContext = createContext<LightboxContextValue | null>(null);

interface LightboxProviderProps {
  children: ReactNode;
}

// lightbox provider that manages lightbox state
export function LightboxProvider({ children }: LightboxProviderProps) {
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

  const value = useMemo<LightboxContextValue>(
    () => ({
      isOpen,
      currentImage,
      openLightbox,
      closeLightbox,
    }),
    [isOpen, currentImage, openLightbox, closeLightbox]
  );

  return (
    <LightboxContext.Provider value={value}>
      {children}
    </LightboxContext.Provider>
  );
}

// hook to access the lightbox context
export function useLightbox(): LightboxContextValue {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error('useLightbox must be used within a LightboxProvider');
  }
  return context;
}

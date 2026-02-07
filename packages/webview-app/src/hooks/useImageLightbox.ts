// packages/webview-app/src/hooks/useImageLightbox.ts
// shared hook for handling image clicks to open lightbox

import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { useLightbox } from '../context/LightboxContext';

// hook for handling image clicks to open lightbox
// consolidate duplicate image click handling from SafePreview & TrustedPreview
export function useImageLightbox() {
  const { openLightbox } = useLightbox();

  // handle image click to open lightbox
  // support both native MouseEvent (for addEventListener) & React.MouseEvent (for onClick)
  const handleImageClick = useCallback(
    (e: MouseEvent | ReactMouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        e.preventDefault();
        openLightbox(img.src, img.alt);
      }
    },
    [openLightbox]
  );

  return { handleImageClick, openLightbox };
}

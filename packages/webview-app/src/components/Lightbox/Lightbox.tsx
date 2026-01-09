// packages/webview-app/src/components/Lightbox/Lightbox.tsx
// fullscreen image lightbox modal component

import { useEffect, useCallback } from 'react';
import { useLightbox } from '../../context/LightboxContext';
import './Lightbox.css';

// lightbox modal for viewing images fullscreen
export function Lightbox() {
  const { isOpen, currentImage, closeLightbox } = useLightbox();

  // handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeLightbox();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeLightbox]);

  // handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // only close if clicking the backdrop itself, not the image
      if (e.target === e.currentTarget) {
        closeLightbox();
      }
    },
    [closeLightbox]
  );

  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div
      className="mdx-lightbox-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={currentImage.alt || 'Image preview'}
    >
      <button
        className="mdx-lightbox-close"
        onClick={closeLightbox}
        aria-label="Close lightbox"
      >
        &times;
      </button>
      <img
        className="mdx-lightbox-image"
        src={currentImage.src}
        alt={currentImage.alt || ''}
      />
      {currentImage.alt && (
        <div className="mdx-lightbox-caption">{currentImage.alt}</div>
      )}
    </div>
  );
}

export default Lightbox;

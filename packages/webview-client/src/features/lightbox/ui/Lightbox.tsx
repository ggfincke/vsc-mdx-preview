// packages/webview-client/src/features/lightbox/ui/Lightbox.tsx
// fullscreen image lightbox w/ zoom, pan & gallery navigation

import { useEffect, useCallback, useRef } from 'react';
import { useLightbox, clampZoom } from '../../../app/state/LightboxContext';
import { cn } from '../../../shared/utils/cn';
import './Lightbox.css';

const ZOOM_STEP = 0.25;
const ZOOM_TOGGLE_TARGET = 2;
const DRAG_CLOSE_GUARD_MS = 150;

function getCursorOffsetFromImageCenter(
  event: { clientX: number; clientY: number },
  imageElement: HTMLImageElement
): { x: number; y: number } {
  const rect = imageElement.getBoundingClientRect();
  const imgCenterX = rect.left + rect.width / 2;
  const imgCenterY = rect.top + rect.height / 2;

  return {
    x: event.clientX - imgCenterX,
    y: event.clientY - imgCenterY,
  };
}

// lightbox modal for viewing images fullscreen w/ zoom & gallery
export function Lightbox() {
  const {
    isOpen,
    currentImage,
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
  } = useLightbox();

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastDragEndRef = useRef(0);
  const imageRef = useRef<HTMLImageElement>(null);
  // track whether transition should be disabled (during drag)
  const suppressTransitionRef = useRef(false);

  const hasGallery = imageList.length > 1;

  // handle keyboard navigation & close
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          if (hasGallery) {
            navigatePrev();
          }
          break;
        case 'ArrowRight':
          if (hasGallery) {
            navigateNext();
          }
          break;
        case '0':
          resetView();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeLightbox, hasGallery, navigateNext, navigatePrev, resetView]);

  // handle backdrop click (close only if not dragging & zoom is 1x)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) {
        return;
      }
      // guard against accidental close after drag
      if (Date.now() - lastDragEndRef.current < DRAG_CLOSE_GUARD_MS) {
        return;
      }
      closeLightbox();
    },
    [closeLightbox]
  );

  // wheel zoom centered on cursor position
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = zoom + delta;

      if (!imageRef.current) {
        setZoom(newZoom);
        return;
      }

      const cursorOffset = getCursorOffsetFromImageCenter(
        e,
        imageRef.current
      );
      const clampedZoom = clampZoom(newZoom);
      const scale = clampedZoom / zoom;

      setOffset({
        x: offset.x - cursorOffset.x * (scale - 1),
        y: offset.y - cursorOffset.y * (scale - 1),
      });
      setZoom(clampedZoom);
    },
    [zoom, offset, setZoom, setOffset]
  );

  // double-click to toggle zoom 1x <-> 2x
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (zoom === 1) {
        // zoom in to 2x centered on click
        if (imageRef.current) {
          const cursorOffset = getCursorOffsetFromImageCenter(
            e,
            imageRef.current
          );
          setOffset({
            x: -cursorOffset.x * (ZOOM_TOGGLE_TARGET - 1),
            y: -cursorOffset.y * (ZOOM_TOGGLE_TARGET - 1),
          });
        }
        setZoom(ZOOM_TOGGLE_TARGET);
      } else {
        resetView();
      }
    },
    [zoom, setZoom, setOffset, resetView]
  );

  // pointer events for drag-to-pan
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) {
        return;
      }
      e.preventDefault();
      isDraggingRef.current = true;
      suppressTransitionRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragOffsetRef.current = { ...offset };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoom, offset]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) {
        return;
      }
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset({
        x: dragOffsetRef.current.x + dx,
        y: dragOffsetRef.current.y + dy,
      });
    },
    [setOffset]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) {
        return;
      }
      isDraggingRef.current = false;
      suppressTransitionRef.current = false;
      lastDragEndRef.current = Date.now();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  // navigation button handlers (stop propagation to prevent backdrop close)
  const handlePrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigatePrev();
    },
    [navigatePrev]
  );

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigateNext();
    },
    [navigateNext]
  );

  if (!isOpen || !currentImage) {
    return null;
  }

  // compute image transform
  const imageTransform =
    zoom !== 1 || offset.x !== 0 || offset.y !== 0
      ? `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`
      : undefined;

  const isZoomed = zoom > 1;
  const imageClasses = cn(
    'mdx-preview-lightbox-image',
    isZoomed && 'mdx-preview-lightbox-image--zoomed',
    isDraggingRef.current && 'mdx-preview-lightbox-image--dragging',
    suppressTransitionRef.current &&
      'mdx-preview-lightbox-image--no-transition'
  );

  return (
    <div
      className={cn('mdx-preview-lightbox-overlay', isZoomed && 'mdx-preview-lightbox-overlay--zoomed')}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      role="dialog"
      aria-modal="true"
      aria-label={currentImage.alt || 'Image preview'}
    >
      <button
        className="mdx-preview-lightbox-close"
        onClick={closeLightbox}
        aria-label="Close lightbox"
      >
        &times;
      </button>

      {hasGallery && (
        <button
          className="mdx-preview-lightbox-nav mdx-preview-lightbox-nav--prev"
          onClick={handlePrev}
          aria-label="Previous image"
        >
          &#8249;
        </button>
      )}

      <img
        ref={imageRef}
        className={imageClasses}
        src={currentImage.src}
        alt={currentImage.alt || ''}
        style={{ transform: imageTransform }}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        draggable={false}
      />

      {hasGallery && (
        <button
          className="mdx-preview-lightbox-nav mdx-preview-lightbox-nav--next"
          onClick={handleNext}
          aria-label="Next image"
        >
          &#8250;
        </button>
      )}

      {hasGallery && (
        <div className="mdx-preview-lightbox-counter">
          {currentIndex + 1} of {imageList.length}
        </div>
      )}

      {currentImage.alt && (
        <div className="mdx-preview-lightbox-caption">
          {currentImage.alt}
        </div>
      )}
    </div>
  );
}

export default Lightbox;

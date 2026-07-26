// packages/webview-client/src/features/lightbox/hooks/useImageLightbox.ts
// shared hook for handling image clicks to open lightbox w/ section-scoped gallery

import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import {
  useLightboxActions,
  type LightboxImage,
} from '../../../app/state/LightboxContext';
import {
  SAFE_PREVIEW_CLASS,
  TRUSTED_PREVIEW_CLASS,
} from '../../preview/safe/security/previewClassNames';

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

const PREVIEW_CONTAINER_SELECTOR = `.${SAFE_PREVIEW_CLASS}, .${TRUSTED_PREVIEW_CLASS}`;

interface CollectedImage {
  element: HTMLImageElement;
  image: LightboxImage;
}

// find the preview container by traversing up from the clicked element
function findPreviewContainer(el: HTMLElement): HTMLElement | null {
  return el.closest(PREVIEW_CONTAINER_SELECTOR) as HTMLElement | null;
}

// check if an element is a valid lightbox image
function isValidImage(img: HTMLImageElement): boolean {
  return !!img.src && img.naturalWidth > 1 && img.naturalHeight > 1;
}

// collect images from a range of sibling elements (between section boundaries)
function collectImagesInRange(
  container: HTMLElement,
  startAfter: Element | null,
  stopAt: Element | null
): CollectedImage[] {
  const list: CollectedImage[] = [];
  const children = container.children;
  let inRange = !startAfter;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child === startAfter) {
      inRange = true;
      continue;
    }

    if (child === stopAt) {
      break;
    }

    if (!inRange) {
      continue;
    }

    // include a direct img child plus nested images
    const imgs = [
      ...(child.tagName === 'IMG' ? [child as HTMLImageElement] : []),
      ...child.querySelectorAll('img'),
    ];
    for (const img of imgs) {
      if (isValidImage(img)) {
        list.push({
          element: img,
          image: {
            src: img.src,
            alt: img.alt || undefined,
          },
        });
      }
    }
  }

  return list;
}

// find the section boundaries (heading -> next heading) containing the clicked image
// returns [sectionHeading, nextHeading] where either can be null
function findSectionBoundaries(
  container: HTMLElement,
  clickedImg: HTMLImageElement
): [Element | null, Element | null] {
  const children = container.children;
  let sectionHeading: Element | null = null;
  let foundImg = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (HEADING_TAGS.has(child.tagName)) {
      if (foundImg) {
        // clicked image was in previous section, this heading ends it
        return [sectionHeading, child];
      }
      // new potential section start
      sectionHeading = child;
    }

    if (child.contains(clickedImg) || child === clickedImg) {
      foundImg = true;
    }
  }

  // image is in the last section (no heading after it)
  return [sectionHeading, null];
}

// collect images scoped to the section containing the clicked image
function collectSectionImageList(
  container: HTMLElement,
  clickedImg: HTMLImageElement
): CollectedImage[] {
  const [sectionHeading, nextHeading] = findSectionBoundaries(
    container,
    clickedImg
  );
  return collectImagesInRange(container, sectionHeading, nextHeading);
}

// hook for handling image clicks to open lightbox w/ gallery navigation
// consolidate duplicate image click handling from SafePreview & TrustedPreview
export function useImageLightbox() {
  const { openLightbox } = useLightboxActions();

  // handle image click to open lightbox
  // support both native MouseEvent (for addEventListener) & React.MouseEvent (for onClick)
  const handleImageClick = useCallback(
    (e: MouseEvent | ReactMouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        e.preventDefault();

        // collect gallery scoped to the section containing the clicked image
        const container = findPreviewContainer(img);
        if (container) {
          const collected = collectSectionImageList(container, img);
          const list = collected.map(({ image }) => image);
          const clickedIndex = Math.max(
            0,
            collected.findIndex(({ element }) => element === img)
          );
          openLightbox(img.src, img.alt || undefined, list, clickedIndex);
        } else {
          // fallback: single-image mode
          openLightbox(img.src, img.alt || undefined);
        }
      }
    },
    [openLightbox]
  );

  return { handleImageClick, openLightbox };
}

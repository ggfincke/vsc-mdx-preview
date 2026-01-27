// packages/webview-app/src/hooks/useSafeModeProcessing.ts
// encapsulates Safe Mode HTML post-processing (sanitization, link/image processing, code block enhancement)

import { useEffect, type RefObject } from 'react';
import DOMPurify from 'dompurify';
import { enhanceCodeBlocks } from '../components/CodeBlock';
import { DOMPURIFY_CONFIG, ensureSafeModeStyles } from '../security';

// process links in a DocumentFragment or HTMLElement for security
// internal anchor links (#...) are left unchanged
// external links get target="_blank" & rel="noopener noreferrer"
function processLinksInFragment(container: DocumentFragment | HTMLElement): void {
  const links = container.querySelectorAll('a');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) {
      return;
    }
    // external links (open in new tab securely)
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

// add clickable cursor to images for lightbox functionality
function processImagesInFragment(container: DocumentFragment | HTMLElement): void {
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    (img as HTMLElement).style.cursor = 'zoom-in';
  });
}

// hook for processing Safe Mode HTML content
// handles sanitization, security post-processing, & code block enhancement
// this is necessarily imperative because Safe Mode renders pre-compiled HTML
// (not React components), requiring DOM manipulation after innerHTML injection
//
// Performance optimization: uses DocumentFragment for off-DOM manipulation
// to reduce layout recalculations from 4+ to 1
export function useSafeModeProcessing(
  containerRef: RefObject<HTMLDivElement>,
  html: string
): void {
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // 1. sanitize HTML before rendering
    const sanitizedHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);

    // 2. parse into template for off-DOM manipulation
    // using <template> element which creates a DocumentFragment
    const template = document.createElement('template');
    template.innerHTML = sanitizedHTML as string;
    const fragment = template.content;

    // 3. process in fragment (no layout triggered - elements not in DOM)
    // querySelectorAll works on DocumentFragment
    processLinksInFragment(fragment);
    processImagesInFragment(fragment);

    // 4. single DOM update - only one layout recalculation
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(fragment);

    // 5. style injection (no layout, just CSS)
    ensureSafeModeStyles();

    // 6. code block enhancement requires real DOM for event listeners
    // (copy button click handlers need elements to be in the document)
    enhanceCodeBlocks(containerRef.current);
  }, [html, containerRef]);
}

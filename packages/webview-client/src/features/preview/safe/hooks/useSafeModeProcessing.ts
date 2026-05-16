// packages/webview-client/src/features/preview/safe/hooks/useSafeModeProcessing.ts
// encapsulates Safe Mode HTML sanitization & DOM injection

import { useLayoutEffect, type RefObject } from 'react';
import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG, ensureSafeModeStyles } from '../security';

// hook for processing Safe Mode HTML content
// handle sanitization & inject into container
// use useLayoutEffect for synchronous DOM injection before paint
export function useSafeModeProcessing(
  containerRef: RefObject<HTMLDivElement>,
  html: string
): void {
  useLayoutEffect(() => {
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

    // 3. single DOM update - only one layout recalculation
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(fragment);

    // 4. style injection (no layout, just CSS)
    ensureSafeModeStyles();
  }, [html, containerRef]);
}

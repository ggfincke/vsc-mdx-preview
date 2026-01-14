// packages/webview-app/src/hooks/useSafeModeProcessing.ts
// encapsulates Safe Mode HTML post-processing (sanitization, link/image processing, code block enhancement)

import { useEffect, type RefObject } from 'react';
import DOMPurify from 'dompurify';
import { enhanceCodeBlocks } from '../components/CodeBlock';
import {
  DOMPURIFY_CONFIG,
  processLinks,
  processImages,
  ensureSafeModeStyles,
} from '../security';

// hook for processing Safe Mode HTML content
// handles sanitization, security post-processing, & code block enhancement
// this is necessarily imperative because Safe Mode renders pre-compiled HTML
// (not React components), requiring DOM manipulation after innerHTML injection
export function useSafeModeProcessing(
  containerRef: RefObject<HTMLDivElement>,
  html: string
): void {
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // sanitize HTML before rendering
    const sanitizedHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);

    // set sanitized content
    containerRef.current.innerHTML = sanitizedHTML as string;

    // post-process links for security
    processLinks(containerRef.current);

    // add safe mode styles
    ensureSafeModeStyles();

    // add clickable styles to images
    processImages(containerRef.current);

    // enhance code blocks (copy button, language badge)
    enhanceCodeBlocks(containerRef.current);
  }, [html, containerRef]);
}

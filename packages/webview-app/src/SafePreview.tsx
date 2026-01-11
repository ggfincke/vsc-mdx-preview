// packages/webview-app/src/SafePreview.tsx
// render pre-sanitized HTML in Safe Mode (no JavaScript execution)

import { useEffect, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { enhanceCodeBlocks } from './components/CodeBlock';
import { useLightbox } from './context/LightboxContext';
import { useMermaidRendering } from './hooks';
import {
  DOMPURIFY_CONFIG,
  processLinks,
  processImages,
  ensureSafeModeStyles,
} from './security';

interface SafePreviewRendererProps {
  html: string;
}

// render sanitized HTML content in Safe Mode (use ref to set innerHTML after sanitization)
export function SafePreviewRenderer({ html }: SafePreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { openLightbox } = useLightbox();

  // use shared mermaid hook (after-paint mode for Safe Mode)
  const { renderPortals } = useMermaidRendering(containerRef, {
    mode: 'after-paint',
  });

  // handle image click to open lightbox
  const handleImageClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        e.preventDefault();
        openLightbox(img.src, img.alt);
      }
    },
    [openLightbox]
  );

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
  }, [html]);

  // add image click event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener('click', handleImageClick);
    return () => {
      container.removeEventListener('click', handleImageClick);
    };
  }, [handleImageClick]);

  return (
    <div
      ref={containerRef}
      className="mdx-safe-preview markdown-body"
      data-mode="safe"
    >
      {/* render mermaid diagrams via React portals */}
      {renderPortals()}
    </div>
  );
}

export default SafePreviewRenderer;

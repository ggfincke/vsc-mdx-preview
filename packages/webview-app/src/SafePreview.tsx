// packages/webview-app/src/SafePreview.tsx
// render pre-sanitized HTML in Safe Mode (no JavaScript execution)

import { useEffect, useRef } from 'react';
import {
  useMermaidRendering,
  useImageLightbox,
  useSafeModeProcessing,
} from './hooks';
import { PreviewContainer } from './components/PreviewContainer';

interface SafePreviewRendererProps {
  html: string;
}

// render sanitized HTML content in Safe Mode (use ref to set innerHTML after sanitization)
export function SafePreviewRenderer({ html }: SafePreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleImageClick } = useImageLightbox();

  // use shared mermaid hook (after-paint mode for Safe Mode)
  const { renderPortals } = useMermaidRendering(containerRef, {
    mode: 'after-paint',
  });

  // process Safe Mode HTML (sanitize, post-process links/images, enhance code blocks)
  useSafeModeProcessing(containerRef, html);

  // add image click event listener (imperative for Safe Mode since HTML is injected)
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
    <PreviewContainer
      containerRef={containerRef}
      mode="safe"
      mermaidPortals={renderPortals()}
      className="markdown-body"
    />
  );
}

export default SafePreviewRenderer;

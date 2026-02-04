// packages/webview-app/src/SafePreview.tsx
// render pre-sanitized HTML in Safe Mode (no JavaScript execution)

import { memo, useEffect } from 'react';
import {
  useSafeModeProcessing,
  usePreviewSetup,
  useKatexDetection,
} from './hooks';
import { PreviewContainer } from './components/PreviewContainer/PreviewContainer';
import { fastStringEquals } from './utils/memoCompare';

interface SafePreviewRendererProps {
  html: string;
}

// render sanitized HTML content in Safe Mode (use ref to set innerHTML after sanitization)
// wrapped w/ React.memo to prevent unnecessary re-renders
export const SafePreviewRenderer = memo(
  function SafePreviewRenderer({ html }: SafePreviewRendererProps) {
    // shared preview setup (container ref, mermaid rendering, image lightbox)
    const { containerRef, handleImageClick, renderPortals } = usePreviewSetup({
      mermaidMode: 'after-paint',
    });

    // process Safe Mode HTML (sanitize, post-process links/images, enhance code blocks)
    useSafeModeProcessing(containerRef, html);

    // lazy-load KaTeX CSS when math content is detected (string-based detection)
    useKatexDetection({ html });

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
    }, [containerRef, handleImageClick]);

    return (
      <PreviewContainer
        containerRef={containerRef}
        mode="safe"
        mermaidPortals={renderPortals()}
        className="markdown-body"
      />
    );
  },
  // custom comparison: fast-path length check before full string comparison
  (prevProps, nextProps) => fastStringEquals(prevProps.html, nextProps.html)
);

export default SafePreviewRenderer;

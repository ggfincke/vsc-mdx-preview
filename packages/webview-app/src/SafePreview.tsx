// packages/webview-app/src/SafePreview.tsx
// render pre-sanitized HTML in Safe Mode (no JavaScript execution)

import { memo, useEffect, useLayoutEffect } from 'react';
import { useSafeModeProcessing, usePreviewSetup } from './hooks';
import { PreviewContainer } from './components/PreviewContainer/PreviewContainer';
import { loadKatexCss } from './utils/katexLoader';
import { fastStringEquals } from './utils/memoCompare';

interface SafePreviewRendererProps {
  html: string;
}

// render sanitized HTML content in Safe Mode (use ref to set innerHTML after sanitization)
// wrapped w/ React.memo to prevent re-renders when only zoom changes (html unchanged)
export const SafePreviewRenderer = memo(
  function SafePreviewRenderer({ html }: SafePreviewRendererProps) {
    // shared preview setup (container ref, mermaid rendering, image lightbox)
    const { containerRef, handleImageClick, renderPortals } = usePreviewSetup({
      mermaidMode: 'after-paint',
    });

    // process Safe Mode HTML (sanitize, post-process links/images, enhance code blocks)
    useSafeModeProcessing(containerRef, html);

    // lazy-load KaTeX CSS when math content is detected
    // uses useLayoutEffect for synchronous loading to avoid FOUC
    useLayoutEffect(() => {
      if (html.includes('class="katex"') || html.includes('class="math')) {
        loadKatexCss();
      }
    }, [html]);

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
  // Custom comparison: fast-path length check before full string comparison
  // For large HTML (100KB+), length mismatch returns false in O(1) vs O(n) string compare
  (prevProps, nextProps) => fastStringEquals(prevProps.html, nextProps.html)
);

export default SafePreviewRenderer;

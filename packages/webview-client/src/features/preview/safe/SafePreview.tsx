// packages/webview-client/src/features/preview/safe/SafePreview.tsx
// render pre-sanitized HTML in Safe Mode (no JavaScript execution)

import { memo, useEffect } from 'react';
import { usePreviewSetup } from '../shared/hooks/usePreviewSetup';
import { useSourceLineHighlight } from '../shared/hooks/useSourceLineHighlight';
import { useSafeModeProcessing } from './hooks/useSafeModeProcessing';
import { useKatexDetection } from '../../code-block/hooks/useKatexDetection';
import { PreviewContainer } from '../shared/ui/PreviewContainer/PreviewContainer';
import { fastStringEquals } from '../../../shared/utils/memoCompare';
import { useToc } from '../../../app/state';

interface SafePreviewRendererProps {
  html: string;
}

// render sanitized HTML content in Safe Mode (use ref to set innerHTML after sanitization)
// wrapped w/ React.memo to prevent unnecessary re-renders
export const SafePreviewRenderer = memo(
  function SafePreviewRenderer({ html }: SafePreviewRendererProps) {
    const { sourceLineHighlightEnabled } = useToc();

    // shared preview setup (container ref, diagram rendering, image lightbox)
    const { containerRef, handleImageClick, renderPortals } = usePreviewSetup({
      diagramMode: 'after-paint',
    });

    // process Safe Mode HTML (sanitize, post-process links/images, enhance code blocks)
    useSafeModeProcessing(containerRef, html);

    // bind MPE-style source-line hover highlights after HTML injection
    useSourceLineHighlight({
      containerRef,
      trigger: html,
      enabled: sourceLineHighlightEnabled,
    });

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
        diagramPortals={renderPortals()}
        className="markdown-body"
      />
    );
  },
  // custom comparison: fast-path length check before full string comparison
  (prevProps, nextProps) => fastStringEquals(prevProps.html, nextProps.html)
);

export default SafePreviewRenderer;

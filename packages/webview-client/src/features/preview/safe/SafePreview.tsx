// packages/webview-client/src/features/preview/safe/SafePreview.tsx
// render pre-sanitized HTML in Safe Mode (no JavaScript execution)

import { memo } from 'react';
import { usePreviewSetup } from '../shared/hooks/usePreviewSetup';
import { usePreviewInteractions } from '../shared/hooks/usePreviewInteractions';
import { useSafeModeProcessing } from './hooks/useSafeModeProcessing';
import { PreviewContainer } from '../shared/ui/PreviewContainer/PreviewContainer';
import { fastStringEquals } from '../../../shared/utils/memoCompare';

interface SafePreviewRendererProps {
  html: string;
}

// render sanitized HTML content in Safe Mode (use ref to set innerHTML after sanitization)
// wrapped w/ React.memo to prevent unnecessary re-renders
export const SafePreviewRenderer = memo(
  function SafePreviewRenderer({ html }: SafePreviewRendererProps) {
    // shared preview setup (container ref, diagram rendering, image lightbox)
    const { containerRef, handleImageClick, renderPortals } = usePreviewSetup({
      diagramMode: 'before-paint',
      filterStale: true,
    });

    // sanitize & inject Safe Mode HTML
    useSafeModeProcessing(containerRef, html);

    usePreviewInteractions({
      mode: 'safe',
      containerRef,
      html,
    });

    return (
      <PreviewContainer
        containerRef={containerRef}
        mode="safe"
        onImageClick={handleImageClick}
        diagramPortals={renderPortals()}
        className="markdown-body"
      />
    );
  },
  // custom comparison: fast-path length check before full string comparison
  (prevProps, nextProps) => fastStringEquals(prevProps.html, nextProps.html)
);

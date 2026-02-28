// packages/webview-client/src/features/preview/shared/hooks/usePreviewSetup.ts
// shared preview setup hook - consolidate diagram rendering, lightbox & container ref

import { useRef, type RefObject, type ReactNode } from 'react';
import { DIAGRAM_SCAN_ADAPTERS } from '../../../diagrams/hooks/diagramAdapters';
import { useDiagramScanCoordinator } from '../../../diagrams/hooks/useDiagramScanCoordinator';
import { useImageLightbox } from '../../../lightbox/hooks/useImageLightbox';
import { useTocExtraction } from './useTocExtraction';

export type DiagramScanMode = 'after-paint' | 'before-paint';

interface PreviewSetupOptions {
  // diagram scan timing mode
  diagramMode: DiagramScanMode;
  // filter stale diagram elements
  filterStale?: boolean;
}

interface PreviewSetupResult {
  // preview container ref
  containerRef: RefObject<HTMLDivElement>;
  // image click handler for lightbox
  handleImageClick: (e: MouseEvent | React.MouseEvent) => void;
  // render diagram portals
  renderPortals: () => ReactNode;
  // manually trigger diagram scans
  scan: () => void;
  // extract headings from DOM for TOC sidebar
  extractHeadings: () => void;
}

// shared preview setup - provide container ref, diagram rendering & lightbox
// use in SafePreview & TrustedPreview to consolidate shared setup logic
export function usePreviewSetup(
  options: PreviewSetupOptions
): PreviewSetupResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleImageClick } = useImageLightbox();
  const extractHeadings = useTocExtraction(containerRef);
  const diagrams = useDiagramScanCoordinator(containerRef, {
    mode: options.diagramMode,
    filterStale: options.filterStale,
    adapters: DIAGRAM_SCAN_ADAPTERS,
  });

  return {
    containerRef,
    handleImageClick,
    renderPortals: diagrams.renderPortals,
    scan: diagrams.scan,
    extractHeadings,
  };
}

// packages/webview-app/src/hooks/usePreviewSetup.ts
// shared preview setup hook - consolidates mermaid, lightbox & container ref

import { useRef, type RefObject, type ReactNode } from 'react';
import {
  useMermaidRendering,
  type MermaidScanMode,
} from './useMermaidRendering';
import { useImageLightbox } from './useImageLightbox';

interface PreviewSetupOptions {
  // mermaid scan timing mode
  mermaidMode: MermaidScanMode;
  // filter stale mermaid elements
  filterStale?: boolean;
}

interface PreviewSetupResult {
  // preview container ref
  containerRef: RefObject<HTMLDivElement>;
  // image click handler for lightbox
  handleImageClick: (e: MouseEvent | React.MouseEvent) => void;
  // render mermaid portals
  renderPortals: () => ReactNode;
  // manually trigger mermaid scan
  scan: () => void;
}

// shared preview setup - provides common container ref, mermaid rendering & lightbox
// use in SafePreview & TrustedPreview to consolidate shared setup logic
export function usePreviewSetup(
  options: PreviewSetupOptions
): PreviewSetupResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleImageClick } = useImageLightbox();
  const { renderPortals, scan } = useMermaidRendering(containerRef, {
    mode: options.mermaidMode,
    filterStale: options.filterStale,
  });

  return { containerRef, handleImageClick, renderPortals, scan };
}

// packages/webview-app/src/hooks/usePreviewSetup.ts
// shared preview setup hook - consolidates mermaid, lightbox & container ref

import { useRef, type RefObject, type ReactNode } from 'react';
import {
  useMermaidRendering,
  type MermaidScanMode,
} from './useMermaidRendering';
import { useImageLightbox } from './useImageLightbox';

interface PreviewSetupOptions {
  // mermaid rendering mode: 'after-paint' for Safe Mode, 'before-paint' for Trusted
  mermaidMode: MermaidScanMode;
  // filter stale mermaid elements (Trusted Mode only)
  filterStale?: boolean;
}

interface PreviewSetupResult {
  // ref to attach to the preview container div
  containerRef: RefObject<HTMLDivElement>;
  // handler for image click events (opens lightbox)
  handleImageClick: (e: MouseEvent | React.MouseEvent) => void;
  // render mermaid portals (returns ReactNode)
  renderPortals: () => ReactNode;
  // manually trigger mermaid scan (for post-render scanning)
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

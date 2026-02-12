// packages/webview-app/src/hooks/usePreviewSetup.ts
// shared preview setup hook - consolidate diagram rendering, lightbox & container ref

import { useRef, type RefObject, type ReactNode } from 'react';
import { useMermaidRendering } from '../../../diagrams/hooks/useMermaidRendering';
import { usePlantUMLRendering } from '../../../diagrams/hooks/usePlantUMLRendering';
import { useGraphvizRendering } from '../../../diagrams/hooks/useGraphvizRendering';
import { useImageLightbox } from '../../../lightbox/hooks/useImageLightbox';

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
}

// shared preview setup - provide container ref, diagram rendering & lightbox
// use in SafePreview & TrustedPreview to consolidate shared setup logic
export function usePreviewSetup(
  options: PreviewSetupOptions
): PreviewSetupResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleImageClick } = useImageLightbox();
  const mermaid = useMermaidRendering(containerRef, {
    mode: options.diagramMode,
    filterStale: options.filterStale,
  });
  const plantUml = usePlantUMLRendering(containerRef, {
    mode: options.diagramMode,
    filterStale: options.filterStale,
  });
  const graphviz = useGraphvizRendering(containerRef, {
    mode: options.diagramMode,
    filterStale: options.filterStale,
  });

  const renderPortals = (): ReactNode => [
    ...mermaid.renderPortals(),
    ...plantUml.renderPortals(),
    ...graphviz.renderPortals(),
  ];

  const scan = (): void => {
    mermaid.scan();
    plantUml.scan();
    graphviz.scan();
  };

  return { containerRef, handleImageClick, renderPortals, scan };
}

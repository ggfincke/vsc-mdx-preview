// packages/webview-client/src/features/preview/shared/hooks/usePreviewSetup.ts
// shared preview setup hook - consolidate diagram rendering, lightbox & container ref

import {
  useCallback,
  useRef,
  useState,
  type RefCallback,
  type RefObject,
  type ReactNode,
} from 'react';
import { DIAGRAM_SCAN_ADAPTERS } from '../../../diagrams/hooks/diagramAdapters';
import {
  useDiagramScanCoordinator,
  type DiagramScanMode,
} from '../../../diagrams/hooks/useDiagramScanCoordinator';
import { useImageLightbox } from '../../../lightbox/hooks/useImageLightbox';

interface PreviewSetupOptions {
  // diagram scan timing mode
  diagramMode: DiagramScanMode;
  // filter stale diagram elements
  filterStale?: boolean;
}

interface PreviewSetupResult {
  // preview container ref
  containerRef: RefObject<HTMLDivElement | null>;
  // publish the attached element while preserving imperative ref consumers
  attachContainer: RefCallback<HTMLDivElement>;
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
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    setContainer(element);
  }, []);
  const { handleImageClick } = useImageLightbox();
  const diagrams = useDiagramScanCoordinator(container, {
    mode: options.diagramMode,
    filterStale: options.filterStale,
    adapters: DIAGRAM_SCAN_ADAPTERS,
  });

  return {
    containerRef,
    attachContainer,
    handleImageClick,
    renderPortals: diagrams.renderPortals,
    scan: diagrams.scan,
  };
}

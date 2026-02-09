// packages/webview-app/src/hooks/useMermaidRendering.tsx
// shared hook for Mermaid diagram rendering in Safe & Trusted modes

import { createDiagramRendering } from './createDiagramRendering';
import { MermaidRenderer } from '../ui/MermaidRenderer/MermaidRenderer';
import { findMermaidContainers } from '../utils/findMermaidContainers';

// timing mode for mermaid scanning
export type MermaidScanMode = 'after-paint' | 'before-paint';

// hook for mermaid diagram detection & portal rendering
export const useMermaidRendering = createDiagramRendering({
  findContainers: findMermaidContainers,
  renderElement: (diagram) => (
    <MermaidRenderer id={diagram.id} code={diagram.code} />
  ),
});

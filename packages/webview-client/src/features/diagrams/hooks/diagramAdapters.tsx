// packages/webview-client/src/features/diagrams/hooks/diagramAdapters.tsx
// adapter definitions for diagram discovery + portal rendering

import type { ReactNode } from 'react';
import type { BaseDiagramInfo } from '../utils/createDiagramContainerFinder';
import { findMermaidContainers } from '../utils/findMermaidContainers';
import { findPlantUMLContainers } from '../utils/findPlantUMLContainers';
import {
  findGraphvizContainers,
  type GraphvizDiagramInfo,
} from '../utils/findGraphvizContainers';
import {
  LazyGraphvizRenderer,
  LazyMermaidRenderer,
  LazyPlantUMLRenderer,
} from '../ui/LazyDiagramRenderers/LazyDiagramRenderers';

// adapter contract for scan coordinator
export interface DiagramScanAdapter {
  // stable identifier used for portal key scoping
  key: string;
  // diagram discovery for a given root
  findContainers: (root: ParentNode) => BaseDiagramInfo[];
  // render a diagram into its target portal element
  renderElement: (diagram: BaseDiagramInfo) => ReactNode;
}

// canonical adapter order is preserved intentionally
export const DIAGRAM_SCAN_ADAPTERS: readonly DiagramScanAdapter[] = [
  {
    key: 'mermaid',
    findContainers: findMermaidContainers,
    renderElement: (diagram) => (
      <LazyMermaidRenderer id={diagram.id} code={diagram.code} />
    ),
  },
  {
    key: 'plantuml',
    findContainers: findPlantUMLContainers,
    renderElement: (diagram) => (
      <LazyPlantUMLRenderer id={diagram.id} code={diagram.code} />
    ),
  },
  {
    key: 'graphviz',
    findContainers: findGraphvizContainers,
    renderElement: (diagram) => {
      const graphvizDiagram = diagram as GraphvizDiagramInfo;
      return (
        <LazyGraphvizRenderer
          id={graphvizDiagram.id}
          code={graphvizDiagram.code}
          language={graphvizDiagram.language}
        />
      );
    },
  },
];

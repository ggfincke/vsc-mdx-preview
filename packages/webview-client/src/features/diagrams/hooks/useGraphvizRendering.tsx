// packages/webview-app/src/hooks/useGraphvizRendering.tsx
// shared hook for Graphviz rendering in Safe & Trusted modes

import { createDiagramRendering } from './createDiagramRendering';
import { GraphvizRenderer } from '../ui/GraphvizRenderer/GraphvizRenderer';
import {
  findGraphvizContainers,
  type GraphvizDiagramInfo,
} from '../utils/findGraphvizContainers';

// timing mode for Graphviz scanning
export type GraphvizScanMode = 'after-paint' | 'before-paint';

// hook for Graphviz detection & portal rendering
export const useGraphvizRendering = createDiagramRendering<GraphvizDiagramInfo>(
  {
    findContainers: findGraphvizContainers,
    renderElement: (diagram) => (
      <GraphvizRenderer
        id={diagram.id}
        code={diagram.code}
        language={diagram.language}
      />
    ),
  }
);

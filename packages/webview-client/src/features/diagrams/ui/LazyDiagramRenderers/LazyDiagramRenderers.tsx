// packages/webview-client/src/features/diagrams/ui/LazyDiagramRenderers/LazyDiagramRenderers.tsx
// lazy renderer boundaries w/ consistent loading surfaces

import { lazy, Suspense } from 'react';
import type { DiagramRendererBaseProps } from '../DiagramRenderer/createDiagramRenderer';
import '../DiagramRenderer/diagram-shared.css';

const MermaidRenderer = lazy(() =>
  import('../MermaidRenderer/MermaidRenderer').then((module) => ({
    default: module.MermaidRenderer,
  }))
);
const PlantUMLRenderer = lazy(() =>
  import('../PlantUMLRenderer/PlantUMLRenderer').then((module) => ({
    default: module.PlantUMLRenderer,
  }))
);
const GraphvizRenderer = lazy(() =>
  import('../GraphvizRenderer/GraphvizRenderer').then((module) => ({
    default: module.GraphvizRenderer,
  }))
);

// preserve the renderer loading surface while its optional module arrives
function DiagramModuleFallback({
  classPrefix,
  loadingText,
}: {
  classPrefix: string;
  loadingText: string;
}) {
  return (
    <div className={`${classPrefix} mdx-preview-diagram`}>
      <div className={`${classPrefix}-loading mdx-preview-diagram-loading`}>
        <div className={`${classPrefix}-spinner mdx-preview-diagram-spinner`} />
        <span>{loadingText}</span>
      </div>
      <div
        className={`${classPrefix}-diagram mdx-preview-diagram-surface`}
        style={{ visibility: 'hidden' }}
      />
    </div>
  );
}

export function LazyMermaidRenderer({ id, code }: DiagramRendererBaseProps) {
  return (
    <Suspense
      fallback={
        <DiagramModuleFallback
          classPrefix="mdx-preview-mermaid"
          loadingText="Loading diagram..."
        />
      }
    >
      <MermaidRenderer id={id} code={code} />
    </Suspense>
  );
}

export function LazyPlantUMLRenderer({ id, code }: DiagramRendererBaseProps) {
  return (
    <Suspense
      fallback={
        <DiagramModuleFallback
          classPrefix="mdx-preview-plantuml"
          loadingText="Rendering diagram..."
        />
      }
    >
      <PlantUMLRenderer id={id} code={code} />
    </Suspense>
  );
}

export function LazyGraphvizRenderer({
  id,
  code,
  language,
}: DiagramRendererBaseProps & { language: 'dot' | 'graphviz' }) {
  return (
    <Suspense
      fallback={
        <DiagramModuleFallback
          classPrefix="mdx-preview-graphviz"
          loadingText="Rendering diagram..."
        />
      }
    >
      <GraphvizRenderer id={id} code={code} language={language} />
    </Suspense>
  );
}

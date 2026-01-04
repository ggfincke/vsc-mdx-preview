// packages/webview-app/src/TrustedPreview.tsx
// render MDX content in Trusted Mode (evaluates transpiled code & renders React component)

import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  ComponentType,
} from 'react';
import { createPortal } from 'react-dom';
import { evaluateModuleToComponent } from './module-loader';
import { MermaidRenderer } from './components/MermaidRenderer';
import {
  findMermaidContainers,
  MermaidDiagramInfo,
} from './utils/findMermaidContainers';
import type { TrustedPreviewContent, PreviewError } from './types';

interface TrustedPreviewRendererProps {
  content: TrustedPreviewContent;
  evaluatedComponent: ComponentType | null;
  onComponentReady: (component: ComponentType | null) => void;
  onError: (error: PreviewError) => void;
}

// evaluate transpiled MDX code & render resulting component (evaluation via module loader using new Function())
export function TrustedPreviewRenderer({
  content,
  evaluatedComponent,
  onComponentReady,
  onError,
}: TrustedPreviewRendererProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // track mermaid diagrams for React portal rendering
  const [mermaidDiagrams, setMermaidDiagrams] = useState<MermaidDiagramInfo[]>(
    []
  );

  // scan for mermaid containers & update state (filter stale elements)
  const scanMermaidContainers = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const found = findMermaidContainers(containerRef.current);
    // filter stale elements (removed from DOM during re-render)
    const valid = found.filter((d) => containerRef.current!.contains(d.el));
    setMermaidDiagrams(valid);
  }, []);

  // evaluate code when content changes
  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      setIsEvaluating(true);

      try {
        const component = await evaluateModuleToComponent(
          content.code,
          content.entryFilePath,
          content.dependencies
        );

        if (!cancelled) {
          onComponentReady(component);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          onError({ message, stack });
        }
      } finally {
        if (!cancelled) {
          setIsEvaluating(false);
        }
      }
    }

    evaluate();

    return () => {
      cancelled = true;
    };
  }, [
    content.code,
    content.entryFilePath,
    content.dependencies,
    onComponentReady,
    onError,
  ]);

  // scan for mermaid containers after MDX renders
  // useLayoutEffect to minimize "Loading diagram..." flash
  useLayoutEffect(() => {
    if (!evaluatedComponent) {
      return;
    }

    // initial scan
    scanMermaidContainers();

    // MutationObserver for dynamic content (async rendering)
    const observer = new MutationObserver(() => {
      scanMermaidContainers();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, [evaluatedComponent, scanMermaidContainers]);

  // show loading state while evaluating
  if (isEvaluating || !evaluatedComponent) {
    return (
      <div className="mdx-trusted-preview-loading">
        <div className="mdx-loading-spinner" />
        <span>Evaluating...</span>
      </div>
    );
  }

  // render evaluated component
  const MDXComponent = evaluatedComponent;
  return (
    <div ref={containerRef} className="mdx-trusted-preview" data-mode="trusted">
      <MDXComponent />
      {/* render mermaid diagrams via React portals */}
      {mermaidDiagrams.map((diagram) =>
        createPortal(
          <MermaidRenderer
            key={diagram.id}
            id={diagram.id}
            code={diagram.code}
          />,
          diagram.el
        )
      )}
    </div>
  );
}

export default TrustedPreviewRenderer;

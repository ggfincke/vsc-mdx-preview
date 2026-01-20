// packages/webview-app/src/TrustedPreview.tsx
// render MDX content in Trusted Mode (evaluates transpiled code & renders React component)

import { useLayoutEffect, useState, useRef, ComponentType } from 'react';
import { evaluateModuleToComponent } from './module-system';
import { useMermaidRendering, useImageLightbox, useAsyncEffect } from './hooks';
import { PreviewContainer } from './components/PreviewContainer';
import type { TrustedPreviewContent, PreviewError } from './types';
import { extractErrorInfo } from '@mdx-preview/shared';

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
  const { handleImageClick } = useImageLightbox();

  // use shared mermaid hook (before-paint mode w/ stale filtering for Trusted Mode)
  const { renderPortals, scan } = useMermaidRendering(containerRef, {
    mode: 'before-paint',
    filterStale: true,
  });

  // evaluate code when content changes
  useAsyncEffect(
    async () => {
      return evaluateModuleToComponent(
        content.code,
        content.entryFilePath,
        content.dependencies
      );
    },
    [content.code, content.entryFilePath, content.dependencies],
    {
      onSuccess: onComponentReady,
      onError: (error) => {
        const { message, stack } = extractErrorInfo(error);
        onError({ message, stack });
      },
      onLoadingChange: setIsEvaluating,
    }
  );

  // trigger mermaid scan when component becomes available
  // (hook's initial scan runs before container is rendered during loading state)
  useLayoutEffect(() => {
    if (evaluatedComponent && containerRef.current) {
      scan();
    }
  }, [evaluatedComponent, scan]);

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
    <PreviewContainer
      containerRef={containerRef}
      mode="trusted"
      onImageClick={handleImageClick}
      mermaidPortals={renderPortals()}
    >
      <MDXComponent />
    </PreviewContainer>
  );
}

export default TrustedPreviewRenderer;

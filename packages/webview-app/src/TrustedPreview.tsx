// packages/webview-app/src/TrustedPreview.tsx
// render MDX content in Trusted Mode (evaluates transpiled code & renders React component)

import { useEffect, useState, ComponentType } from 'react';
import { evaluateModuleToComponent } from './module-loader';
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
    <div className="mdx-trusted-preview" data-mode="trusted">
      <MDXComponent />
    </div>
  );
}

export default TrustedPreviewRenderer;

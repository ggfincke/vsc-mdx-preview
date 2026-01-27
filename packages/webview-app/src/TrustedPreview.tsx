// packages/webview-app/src/TrustedPreview.tsx
// render MDX content in Trusted Mode (evaluates transpiled code & renders React component)

import {
  memo,
  useLayoutEffect,
  useState,
  useRef,
  isValidElement,
  cloneElement,
  createElement,
  type ComponentType,
  type ReactNode,
} from 'react';
import { evaluateModuleToComponent } from './module-system';
import { useMermaidRendering, useImageLightbox, useAsyncEffect } from './hooks';
import { PreviewContainer } from './components/PreviewContainer';
import type { TrustedPreviewContent, PreviewError } from './types';
import { extractErrorInfo } from '@mdx-preview/shared';
import { loadKatexCss } from './utils/katexLoader';

// Resolve MDX export to a renderable React node
// Handles both function components and pre-rendered React elements
// This defensive approach fixes React #130 errors when the MDX module
// returns an element object instead of a component function
function resolveMdxNode(
  exp: unknown,
  props: Record<string, unknown> = {}
): ReactNode {
  let v = exp;

  // Unwrap nested default exports, but don't unwrap React elements
  for (let i = 0; i < 5; i++) {
    if (v && typeof v === 'object' && 'default' in v && !isValidElement(v)) {
      v = (v as { default: unknown }).default;
      continue;
    }
    break;
  }

  // Already a React element - clone with props
  if (isValidElement(v)) {
    return cloneElement(v, props);
  }

  // Function component or string - create element
  if (typeof v === 'function' || typeof v === 'string') {
    return createElement(v, props);
  }

  // Invalid export
  const keys = v && typeof v === 'object' ? Object.keys(v).join(', ') : '';
  throw new Error(
    `Invalid MDX export. Expected function or React element, got: ${typeof v}` +
      (keys ? ` (keys: ${keys})` : '')
  );
}

interface TrustedPreviewRendererProps {
  content: TrustedPreviewContent;
  evaluatedComponent: ComponentType | null;
  onComponentReady: (component: ComponentType | null) => void;
  onError: (error: PreviewError) => void;
}

// custom comparison for React.memo - checks all content fields including dependencies array
function arePropsEqual(
  prevProps: TrustedPreviewRendererProps,
  nextProps: TrustedPreviewRendererProps
): boolean {
  // Check primitive fields
  if (prevProps.content.code !== nextProps.content.code) {
    return false;
  }
  if (prevProps.content.entryFilePath !== nextProps.content.entryFilePath) {
    return false;
  }
  if (prevProps.evaluatedComponent !== nextProps.evaluatedComponent) {
    return false;
  }

  // Check dependencies array (shallow comparison)
  const prevDeps = prevProps.content.dependencies;
  const nextDeps = nextProps.content.dependencies;
  if (prevDeps.length !== nextDeps.length) {
    return false;
  }
  for (let i = 0; i < prevDeps.length; i++) {
    if (prevDeps[i] !== nextDeps[i]) {
      return false;
    }
  }

  // Callbacks (onComponentReady, onError) are stable via useCallback in App.tsx
  return true;
}

// evaluate transpiled MDX code & render resulting component (evaluation via module loader using new Function())
// wrapped w/ React.memo to prevent re-renders when only zoom changes (content unchanged)
export const TrustedPreviewRenderer = memo(
  function TrustedPreviewRenderer({
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

    // lazy-load KaTeX CSS when math content is detected in rendered output
    // uses useLayoutEffect for synchronous loading to avoid FOUC
    useLayoutEffect(() => {
      if (evaluatedComponent && containerRef.current) {
        const hasKatex = containerRef.current.querySelector('.katex, .math');
        if (hasKatex) {
          loadKatexCss();
        }
      }
    }, [evaluatedComponent]);

    // show loading state while evaluating
    if (isEvaluating || !evaluatedComponent) {
      return (
        <div className="mdx-trusted-preview-loading">
          <div className="mdx-loading-spinner" />
          <span>Evaluating...</span>
        </div>
      );
    }

    // render evaluated component using defensive resolver
    // handles both function components and pre-rendered React elements
    const mdxNode = resolveMdxNode(evaluatedComponent);
    return (
      <PreviewContainer
        containerRef={containerRef}
        mode="trusted"
        onImageClick={handleImageClick}
        mermaidPortals={renderPortals()}
      >
        {mdxNode}
      </PreviewContainer>
    );
  },
  arePropsEqual
);

export default TrustedPreviewRenderer;
